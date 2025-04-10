require('dotenv').config();
const { Kafka, logLevel } = require('kafkajs');


const SOURCE_BROKERS = process.env.SOURCE_BROKERS.split(',');
const TARGET_BROKERS = process.env.TARGET_BROKERS.split(',');
const SOURCE_TOPIC = process.env.SOURCE_TOPIC;
const TARGET_TOPIC = process.env.TARGET_TOPIC;



const SASL_CONFIG = (username, password) => ({
  mechanism: 'scram-sha-512',
  username,
  password,
});



// --------- SOURCE CLIENT ---------
const sourceKafka = new Kafka({
  clientId: 'source-client',
  brokers: SOURCE_BROKERS,
  ssl: false,
  sasl: SASL_CONFIG(process.env.SOURCE_SASL_USERNAME, process.env.SOURCE_SASL_PASSWORD),
  logLevel: logLevel.INFO,
});
const consumer = sourceKafka.consumer({ groupId: 'kafka-bridge-group-demo' });

// --------- TARGET CLIENT ---------
const targetKafka = new Kafka({
  clientId: 'target-client',
  brokers: TARGET_BROKERS,
  ssl: false,
  sasl: SASL_CONFIG(process.env.TARGET_SASL_USERNAME, process.env.TARGET_SASL_PASSWORD),
  logLevel: logLevel.INFO,
});
const producer = targetKafka.producer();

// --------- MAIN LOGIC ---------
async function runBridge() {
  await consumer.connect();
  await producer.connect();

  await consumer.subscribe({ topic: SOURCE_TOPIC, fromBeginning: false });

  console.log(`🔗 Bridging from "${SOURCE_TOPIC}" to "${TARGET_TOPIC}"`);

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value.toString();

      try {
        console.log(`📥 ${SOURCE_TOPIC}:`, value);

        await producer.send({
          topic: TARGET_TOPIC,
          messages: [{ value }],
        });

        console.log(`📤 ${TARGET_TOPIC}:`, value);
      } catch (err) {
        console.error('❌ Failed to publish message:', err);
      }
    },
  });
}

runBridge().catch(err => {
  console.error('🚨 Fatal error:', err);
  process.exit(1);
});
