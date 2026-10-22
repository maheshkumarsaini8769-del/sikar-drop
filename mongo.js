// Load environment variables if not already loaded
if (!process.env.MONGODB_URI && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.local');
  } catch (e) {
    try {
      process.loadEnvFile('.env');
    } catch (e2) {}
  }
}

let MongoClient;
try {
  MongoClient = require('mongodb').MongoClient;
} catch (e) {
  try {
    MongoClient = require('/usr/lib/node_modules/mongodb').MongoClient;
  } catch (e2) {
    MongoClient = null;
  }
}

const MONGODB_URI = (process.env.MONGODB_URI || '').trim();
const DB_NAME = 'sikar_drop';

let client = null;
let db = null;
let connectionPromise = null;

async function getMongoDb() {
  if (!MongoClient || !MONGODB_URI) {
    return null;
  }
  if (db) return db;
  if (!connectionPromise) {
    connectionPromise = (async () => {
      try {
        client = new MongoClient(MONGODB_URI, {
          serverSelectionTimeoutMS: 6000,
          connectTimeoutMS: 6000,
          maxPoolSize: 10
        });
        await client.connect();
        db = client.db(DB_NAME);
        console.log('[MongoDB] Connected successfully to cluster0 (database: sikar_drop)');
        return db;
      } catch (err) {
        console.warn('[MongoDB] Connection warning:', err.message);
        connectionPromise = null;
        return null;
      }
    })();
  }
  return connectionPromise;
}

// Background asynchronous document synchronization
async function syncDoc(collectionName, filter, doc) {
  try {
    const database = await getMongoDb();
    if (!database) return;
    const collection = database.collection(collectionName);
    const updateDoc = { ...doc };
    if (!updateDoc._id && (updateDoc.id || updateDoc.key || updateDoc.sku)) {
      updateDoc._id = String(updateDoc.id || updateDoc.key || updateDoc.sku);
    }
    const cleanFilter = filter || (updateDoc._id ? { _id: updateDoc._id } : updateDoc);
    await collection.replaceOne(cleanFilter, updateDoc, { upsert: true });
  } catch (err) {
    console.warn(`[MongoDB] syncDoc error on ${collectionName}:`, err.message);
  }
}

// Background asynchronous document deletion
async function deleteDoc(collectionName, filter) {
  try {
    const database = await getMongoDb();
    if (!database) return null;
    let query = filter;
    if (filter && (filter._id || filter.id || filter.key)) {
      const targetVal = String(filter._id || filter.id || filter.key);
      const orConditions = [{ _id: targetVal }, { id: targetVal }, { key: targetVal }];
      if (targetVal.length === 24 && /^[0-9a-fA-F]{24}$/.test(targetVal)) {
        try {
          const { ObjectId } = require('mongodb');
          orConditions.push({ _id: new ObjectId(targetVal) });
        } catch (e) {}
      }
      query = { $or: orConditions };
    }
    const res = await database.collection(collectionName).deleteMany(query);
    return res;
  } catch (err) {
    console.warn(`[MongoDB] deleteDoc error on ${collectionName}:`, err.message);
    return null;
  }
}


module.exports = {
  MONGODB_URI,
  getMongoDb,
  syncDoc,
  deleteDoc
};
