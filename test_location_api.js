const path = require('path');
const { initDatabase, getDb } = require('./src/config/database');
const locationsController = require('./src/controllers/locationsController');
const productsController = require('./src/controllers/productsController');

// Mock req and res objects
function mockReqRes(body = {}, params = {}, query = {}) {
  const req = { body, params, query };
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    }
  };
  return { req, res };
}

async function runTests() {
  console.log("Starting tests...");
  await initDatabase();
  console.log("Database initialized. Waiting a bit to assure tables exist...");
  
  try {
    // 1. Create Location A-01
    console.log("\n--- Creating Location ---");
    const { req: reqL1, res: resL1 } = mockReqRes({ name: "A-01", description: "Shelf A-01" });
    await locationsController.create(reqL1, resL1);
    console.log("Create Location A-01:", JSON.stringify(resL1.data, null, 2));

    // 2. Create Product PROD-001
    console.log("\n--- Creating Product ---");
    const { req: reqP1, res: resP1 } = mockReqRes({ type: "Item", sku: "PROD-001", name: "Test Product", accountable_quantity: 10 });
    await productsController.create(reqP1, resP1);
    console.log("Create Product:", JSON.stringify(resP1.data, null, 2));

    let newProduct = resP1.data.data || resP1.data;
    const productId = newProduct.id || (typeof newProduct.data === 'object' ? newProduct.data.id : null) || newProduct.id; // handle nested structure if exist
    
    // We should get ID from success payload:
    const realProductId = newProduct.success ? newProduct.data.id : newProduct.id;
    
    // 3. Assign Product to Location
    console.log("\n--- Assigning Product to Location ---");
    const { req: reqA1, res: resA1 } = mockReqRes({ product_id: realProductId }, { tag: "A-01" });
    await locationsController.assignProduct(reqA1, resA1);
    console.log("Assign Product:", JSON.stringify(resA1.data, null, 2));

    // 4. Test Product Location Query
    console.log("\n--- Querying Product Locations ---");
    const { req: reqQ1, res: resQ1 } = mockReqRes({}, { sku: "PROD-001" });
    await productsController.getProductLocations(reqQ1, resQ1);
    console.log("Product Locations:", JSON.stringify(resQ1.data, null, 2));

    // 5. Test Location Content Query
    console.log("\n--- Querying Location Content ---");
    const { req: reqC1, res: resC1 } = mockReqRes({}, { tag: "A-01" });
    await locationsController.getContent(reqC1, resC1);
    console.log("Location Content:", JSON.stringify(resC1.data, null, 2));

  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    process.exit(0);
  }
}

runTests();
