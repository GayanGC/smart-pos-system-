const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const Product = require('./modules/inventory/product.model');

const generateSKU = (name, cat, size = '') => {
  return `${cat.substring(0, 3).toUpperCase()}-${name.substring(0, 4).toUpperCase()}${size ? '-' + size : ''}-${Math.floor(Math.random() * 10000)}`;
};

const itemsData = [
  // RICE
  ...[
    { name: 'Vegetable Fried Rice (S)', price: 700 }, { name: 'Vegetable Fried Rice (L)', price: 1000 },
    { name: 'Egg Fried Rice (S)', price: 750 }, { name: 'Egg Fried Rice (L)', price: 1000 },
    { name: 'Chicken Fried Rice (S)', price: 850 }, { name: 'Chicken Fried Rice (L)', price: 1100 },
    { name: 'Seafood Fried Rice (S)', price: 1100 }, { name: 'Seafood Fried Rice (L)', price: 1450 },
    { name: 'Mix Fried Rice (S)', price: 1350 }, { name: 'Mix Fried Rice (L)', price: 1700 },
    { name: 'Nasiguran Seafood', price: 1850 },
    { name: 'Mongolian Seafood', price: 1850 },
    { name: 'Chopsuey Rice', price: 2400 },
    { name: 'Bite Rice Chicken', price: 1450 },
    { name: 'Bite Rice Seafood', price: 1750 },
    { name: 'Bite Rice Mix', price: 1900 }
  ].map(i => ({ ...i, category: 'RICE' })),

  // KOTTU
  ...[
    { name: 'Vegetable Kottu (S)', price: 650 }, { name: 'Vegetable Kottu (L)', price: 850 },
    { name: 'Egg Kottu (S)', price: 700 }, { name: 'Egg Kottu (L)', price: 950 },
    { name: 'Chicken Kottu (S)', price: 800 }, { name: 'Chicken Kottu (L)', price: 1050 },
    { name: 'Sea Food Kottu (S)', price: 1100 }, { name: 'Sea Food Kottu (L)', price: 1350 },
    { name: 'Mix Kottu (S)', price: 1350 }, { name: 'Mix Kottu (L)', price: 1650 },
    { name: 'Chicken Dolphin Kottu (S)', price: 1000 }, { name: 'Chicken Dolphin Kottu (L)', price: 1300 },
    { name: 'Cheese Kottu Chicken (S)', price: 1100 }, { name: 'Cheese Kottu Chicken (L)', price: 1450 },
    { name: 'Cheese Kottu Egg (S)', price: 1150 }, { name: 'Cheese Kottu Egg (L)', price: 1450 },
    { name: 'Cheese Kottu Vegetable (S)', price: 900 }, { name: 'Cheese Kottu Vegetable (L)', price: 1200 },
    { name: 'Noodle Chicken Kottu (S)', price: 800 }, { name: 'Noodle Chicken Kottu (L)', price: 1050 },
    { name: 'String Hoppers Kottu (S)', price: 800 }, { name: 'String Hoppers Kottu (L)', price: 1050 }
  ].map(i => ({ ...i, category: 'KOTTU' })),

  // NOODLES
  ...[
    { name: 'Vegetable Noodles (S)', price: 600 }, { name: 'Vegetable Noodles (L)', price: 900 },
    { name: 'Egg Noodles (S)', price: 650 }, { name: 'Egg Noodles (L)', price: 900 },
    { name: 'Fish Noodles (S)', price: 750 }, { name: 'Fish Noodles (L)', price: 1000 },
    { name: 'Chicken Noodles (S)', price: 750 }, { name: 'Chicken Noodles (L)', price: 1000 },
    { name: 'Sausage Noodles (S)', price: 750 }, { name: 'Sausage Noodles (L)', price: 1000 },
    { name: 'Seafood Noodles (S)', price: 1000 }, { name: 'Seafood Noodles (L)', price: 1350 },
    { name: 'Mix Noodles (S)', price: 1150 }, { name: 'Mix Noodles (L)', price: 1300 }
  ].map(i => ({ ...i, category: 'NOODLES' })),

  // BAKERY / SHORT EATS
  ...[
    { name: 'මාළු බනිස්', price: 100 }, { name: 'සැමන් බනිස්', price: 100 }, { name: 'විකන් බනිස්', price: 120 },
    { name: 'සොසේජ් බනිස්', price: 100 }, { name: 'ප්රෙසිඩන්ට්', price: 120 }, { name: 'සීනිසම්බල් බනිස්', price: 80 },
    { name: 'Egg Hoppy', price: 100 }, { name: 'සොසේජ් පීසා', price: 120 }, { name: 'චිකන් පීසා', price: 150 },
    { name: 'බිත්තර බනිස්', price: 100 }, { name: 'ජෑම් බනිස්', price: 80 }, { name: 'කිඹුලා බනිස්', price: 70 },
    { name: 'ක්රීම් බනිස්', price: 100 }, { name: 'චොකලට් ක්රීම් බනිස්', price: 120 }, { name: 'මැල්ට් බනිස්', price: 80 },
    { name: 'සීනි බනිස්', price: 70 }, { name: 'ටී බනිස්', price: 60 }, { name: 'අලබොන්ඩා', price: 60 },
    { name: 'අලවඩේ', price: 80 }, { name: 'වැනිලා ස්පොන්ජ්', price: 80 }, { name: 'චොකලට් ස්පොන්ජ්', price: 100 },
    { name: 'ඩෝනට්', price: 100 }, { name: 'බටර් කේක් කෑල්ල', price: 100 }, { name: 'විස්කිලිඤ්ඤා', price: 100 },
    { name: 'මාළු රෝල්ස්', price: 100 }, { name: 'බිත්තර සැමෝසා', price: 120 }, { name: 'චිකන් සැමෝසා', price: 120 },
    { name: 'චිකන් රොටී', price: 120 }, { name: 'මාළු රොටී', price: 120 }, { name: 'බිත්තර රොටී', price: 120 },
    { name: 'හොදි සමග බිත්තර රොටී', price: 150 }, { name: 'පරාටා', price: 50 }, { name: 'හොදි සමග පරාටා', price: 70 },
    { name: 'ෂවර්මා', price: 180 }
  ].map(i => ({ ...i, category: 'BAKERY' })),

  // BREAD
  ...[
    { name: 'රෝස් පාන් 1/4', price: 40 }, { name: 'රෝස් පාන් 1/2', price: 80 }, { name: 'තැටි පාන්', price: 120 },
    { name: 'අව්වඩු පාන් 450g', price: 140 }, { name: 'අව්වඩු පාන් පෙති කැපූ', price: 160 },
    { name: 'සැන්ඩ්විච් පාන්', price: 180 }, { name: 'සැන්ඩ්විච් පාන් පෙති කැපූ', price: 200 }
  ].map(i => ({ ...i, category: 'BREAD' })),

  // CAKES
  ...[
    { name: 'බටර් කේක්', price: 1000 }, { name: 'රිබන් කේක්', price: 1250 }, { name: 'චොකලට් කේක්', price: 1400 }
  ].map(i => ({ ...i, category: 'CAKES' })),

  // CURRIES & MAIN MEALS
  ...[
    { name: 'පරිප්පු', price: 150 }, { name: 'අල', price: 150 }, { name: 'ඵලවලු', price: 130 },
    { name: 'මාළු', price: 200 }, { name: 'වැව් මාළු', price: 250 }, { name: 'මස්', price: 250 },
    { name: 'කරවල', price: 150 }, { name: 'සම්බෝල', price: 100 }, { name: 'බැදපු වැව් මාළු', price: 250 },
    { name: 'එළවලු කෑම', price: 200 }, { name: 'කරවල කෑම (S)', price: 230 }, { name: 'කරවල කෑම (L)', price: 380 },
    { name: 'බිත්තර කෑම (S)', price: 300 }, { name: 'බිත්තර කෑම (L)', price: 400 },
    { name: 'මාළු කෑම (S)', price: 350 }, { name: 'මාළු කෑම (L)', price: 480 },
    { name: 'චිකන් කෑම (S)', price: 400 }, { name: 'චිකන් කෑම (L)', price: 500 },
    { name: 'වැව් මාළු කෑම (S)', price: 450 }, { name: 'වැව් මාළු කෑම (L)', price: 550 },
    { name: 'ආප්ප', price: 25 }, { name: 'බිත්තර ආප්ප', price: 100 }, { name: 'බිත්තර හා චීස් ආප්ප', price: 160 },
    { name: 'චීස් චිකන් ආප්ප', price: 250 }, { name: 'ඉඳිආප්ප 1ක්', price: 10 }
  ].map(i => ({ ...i, category: 'MEALS' })),

  // HOT DRINKS
  ...[
    { name: 'RR Café', price: 100 }, { name: 'RR Tea', price: 100 }, { name: 'Nestomalt', price: 120 },
    { name: 'ප්ලේන් ටී', price: 50 }, { name: 'කිරි තේ', price: 120 }, { name: 'කෝපි', price: 70 },
    { name: 'කිරි කෝපි', price: 140 }
  ].map(i => ({ ...i, category: 'HOT_DRINKS' }))
];

async function seed() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/pos_system');
    console.log('--- DB Connected ---');
    
    console.log('Wiping out existing products...');
    await Product.deleteMany({});
    
    console.log('Seeding new menu products...');
    const productsToInsert = itemsData.map(item => ({
      name: item.name,
      sku: generateSKU(item.name, item.category),
      category: item.category,
      sellingPrice: item.price,
      costPrice: item.price * 0.7, // 30% margin approx
      quantityInStock: 9999, // Unbounded/bulk item
      isActive: true,
      supplier: {
        name: 'Internal Kitchen'
      }
    }));
    
    await Product.insertMany(productsToInsert);
    console.log(`Successfully seeded ${productsToInsert.length} products!`);
    
  } catch (error) {
    console.error('Error during seeding:', error);
  } finally {
    process.exit(0);
  }
}

seed();
