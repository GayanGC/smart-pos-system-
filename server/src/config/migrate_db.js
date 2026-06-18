const { MongoClient } = require('mongoose').mongo;

const SOURCE_URI = 'mongodb://localhost:27017/smart_erp_pos';
const TARGET_URI = process.argv[2] || 'mongodb+srv://admin:gayan1234@cluster0.e13efst.mongodb.net/bakery?retryWrites=true&w=majority';

async function migrate() {
  const sourceClient = new MongoClient(SOURCE_URI);
  const targetClient = new MongoClient(TARGET_URI);

  try {
    console.log('Connecting to Source Database...');
    await sourceClient.connect();
    console.log('Connected to Source Database.');

    console.log('Connecting to Target Database...');
    await targetClient.connect();
    console.log('Connected to Target Database.');

    const sourceDb = sourceClient.db();
    const targetDb = targetClient.db();

    const collections = await sourceDb.listCollections().toArray();
    console.log(`Found ${collections.length} collections in source database.`);

    for (const colInfo of collections) {
      const colName = colInfo.name;
      // Skip system collections if any
      if (colName.startsWith('system.')) continue;

      console.log(`Migrating collection: ${colName}...`);
      const sourceCol = sourceDb.collection(colName);
      const targetCol = targetDb.collection(colName);

      // Fetch all documents from source
      const docs = await sourceCol.find({}).toArray();
      console.log(`Collection "${colName}" has ${docs.length} documents.`);

      if (docs.length > 0) {
        // Clear target collection first
        console.log(`Clearing target collection "${colName}"...`);
        await targetCol.deleteMany({});

        // Drop stale indexes to prevent legacy unique constraint collisions
        try {
          console.log(`Dropping indexes on target collection "${colName}"...`);
          await targetCol.dropIndexes();
        } catch (idxErr) {
          console.log(`No indexes to drop or drop skipped for "${colName}": ${idxErr.message}`);
        }

        // Insert documents into target
        console.log(`Inserting ${docs.length} documents into target "${colName}"...`);
        await targetCol.insertMany(docs);
        console.log(`Successfully migrated "${colName}".`);
      } else {
        console.log(`Collection "${colName}" is empty. Skipping insertion.`);
      }
    }

    console.log('🎉 Database migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sourceClient.close();
    await targetClient.close();
  }
}

migrate();
