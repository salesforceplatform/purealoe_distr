let nforce = require('nforce');
let faye = require('faye');
let express = require('express');
let cors = require('cors');
let app = express();
let server = require('http').Server(app);
let io = require('socket.io')(server);
// The account id of the distributor
let accountId;

let getMixes = (req, res) => {
//    let q = "SELECT Id, Name, Account__r.Name, Account__r.Id, Description__c, Qty__c FROM Bundle__c WHERE Status__c='Submitted to Distributors'";
    let q = "SELECT Id, Name, Description__c, Qty__c FROM Bundle__c WHERE Status__c='Submitted to Distributors'";
    org.query({ query: q }, (err, resp) => {
        if (err) {
            console.log(err);
            res.sendStatus(500);
        } else {
            let mixes = resp.records;
            let prettyMixes = [];
            mixes.forEach(mix => {
                prettyMixes.push({
                    mixId: mix.get("Id"),
                    mixName: mix.get("Name"),
//                    account: mix.get("Account__r").Name,
//                    accountId: mix.get("Account__r").Id,
                    qty: mix.get("Qty__c"),
                    descr: mix.get("Description__c")
                });
            });
            res.json(prettyMixes);
        }
    });

};

let getMixDetails = (req, res) => {
    let mixId = req.params.mixId;
    let q = "SELECT Id, Merchandise__r.Name, Merchandise__r.Price__c, Merchandise__r.Category__c, Merchandise__r.Picture_URL__c, Qty__c " + "FROM Bundle_Item__c " + "WHERE Bundle__c = '" + mixId + "'";
    org.query({ query: q }, (err, resp) => {
        if (err) {
            console.log(err);
            res.sendStatus(500);
        } else {
            let mixItems = resp.records;
            let prettyMixItems = [];
            mixItems.forEach(mixItem => {
                prettyMixItems.push({
                    productName: mixItem.get("Merchandise__r").Name,
                    price: mixItem.get("Merchandise__r").Price__c,
                    pictureURL: mixItem.get("Merchandise__r").Picture_URL__c,
                    mixId: mixItem.get("Id"),
                    productId: mixItem.get("Merchandise__r"),
                    qty: mixItem.get("Qty__c")
                });
            });
            res.json(prettyMixItems);
        }
    });

};

let getInventoryLocation = (req, res) => {
    let productName = req.params.product;
    let warehouseName = req.params.warehouse;
    let q = "SELECT Id, Product__r.Name, Warehouse__r.Name, Warehouse__r.Location__c, Quantity__c " + "FROM StockItem__c " + "WHERE Product__r.Name = '" + productName + "' AND Warehouse__r.Name = '" + warehouseName + "'";
    org.query({ query: q }, (err, resp) => {
        if (err) {
            console.log(err);
            res.sendStatus(500);
        } else {
            let productset = {};
            let products = resp.records;
            products.forEach(product => {
                productset['productName'] = product.get("Product__r").Name;
                productset['warehouse'] = product.get("Warehouse__r").Name;
                productset['location'] = product.get("Warehouse__r").Location__c;
                productset['qty'] = product.get("Quantity__c");
            });
            res.send(JSON.stringify(productset));
            //            res.send(JSON.stringify({productName: product.get("Product__r").Name, warehouse: product.get("Warehouse__r").Name, location: product.get("Warehouse__r").Location__c, qty: product.get("Quantity__c")}));
        }
    });

};

let getInventory = (req, res) => {
    let productName = req.params.product;
    let q = "SELECT Id, Product__r.Name, Warehouse__r.Name, Warehouse__r.Location__c, Quantity__c " + "FROM StockItem__c " + "WHERE Product__r.Name = '" + productName + "'";
    org.query({ query: q }, (err, resp) => {
        if (err) {
            console.log(err);
            res.sendStatus(500);
        } else {
            let productset ={};
            let products = resp.records;
            products.forEach(product => {
                productset['productName'] = product.get("Product__r").Name;
                productset['warehouse'] = product.get("Warehouse__r").Name;
                productset['location'] = product.get("Warehouse__r").Location__c;
                productset['qty'] = product.get("Quantity__c");
            });
            
//            let prettyProducts = new Array();
//            products.forEach(product => {
//                prettyProducts.push({
//                    productName: product.get("Product__r").Name,
//                    warehouse: product.get("Warehouse__r").Name,
//                    location: product.get("Warehouse__r").Location__c,
//                    qty: product.get("Quantity__c")
//                });
//            });
//            res.json(prettyProducts);
            res.send(JSON.stringify(productset));
//            res.send(JSON.stringify({productName: product.get("Product__r").Name, warehouse: product.get("Warehouse__r").Name, location: product.get("Warehouse__r").Location__c, qty: product.get("Quantity__c")}));
        }
    });

};

let approveMix = (req, res) => {
    let mixId = req.params.mixId;
//    let account = req.params.account;
    let event = nforce.createSObject("Bundle_Ordered__e");
    event.set('Bundle_Id__c', mixId);
    event.set("Account_Id__c", "0010O00001rMbCDQA0");
    org.insert({ sobject: event }, err => {
        if (err) {
            console.error(err);
            res.sendStatus(500);
        } else {
            res.sendStatus(200);
        }
    });
}

let PORT = process.env.PORT || 5000;

app.use(cors());
app.use('/', express.static(__dirname + '/www'));
app.use('/swagger', express.static(__dirname + '/swagger'));
app.get('/mixes', getMixes);
app.get('/mixes/:mixId', getMixDetails);
app.get('/inventory/:product', getInventory);
app.get('/inventory/:product/:warehouse', getInventoryLocation);
app.post('/approvals/:mixId', approveMix);


let bayeux = new faye.NodeAdapter({ mount: '/faye', timeout: 45 });
bayeux.attach(server);
bayeux.on('disconnect', function(clientId) {
    console.log('Bayeux server disconnect');
});

server.listen(PORT, () => console.log(`Express server listening on ${ PORT }`));

// Connect to Salesforce
let SF_CLIENT_ID = process.env.SF_CLIENT_ID;
let SF_CLIENT_SECRET = process.env.SF_CLIENT_SECRET;
let SF_USER_NAME = process.env.SF_USER_NAME;
let SF_USER_PASSWORD = process.env.SF_USER_PASSWORD;

let org = nforce.createConnection({
    clientId: SF_CLIENT_ID,
    clientSecret: SF_CLIENT_SECRET,
    environment: "production",
    redirectUri: 'http://localhost:3000/oauth/_callback',
    mode: 'single',
    autoRefresh: true
});

org.authenticate({ username: SF_USER_NAME, password: SF_USER_PASSWORD }, err => {
    if (err) {
        console.error("Salesforce authentication error");
        console.error(err);
    } else {
        console.log("Salesforce authentication successful");
        console.log(org.oauth.instance_url);
        subscribeToPlatformEvents();
    }
});

// Subscribe to Platform Events
let subscribeToPlatformEvents = () => {
    var client = new faye.Client(org.oauth.instance_url + '/cometd/41.0/');
    client.setHeader('Authorization', 'OAuth ' + org.oauth.access_token);
    client.subscribe('/event/Bundle_Submitted__e', function(message) {
        // Send message to all connected Socket.io clients
        io
            .of('/')
            .emit('mix_submitted', {
                mixId: message.payload.Bundle_Id__c,
                mixName: message.payload.Bundle_Name__c,
//                account: message.payload.Account__c,
                qty: message.payload.Qty__c,
                descr: message.payload.Description__c
            });
    });
    client.subscribe('/event/Bundle_Unsubmitted__e', function(message) {
        // Send message to all connected Socket.io clients
        io
            .of('/')
            .emit('mix_unsubmitted', {
                mixId: message.payload.Bundle_Id__c
            });
    });
};