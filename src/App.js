import fs from 'fs';

class App {
  async run() {
    const productData = readMeFile('public/products.md');
    console.log(productData);
  }
}

function readMeFile(filePath) {
  const data = fs.readFileSync(filePath, 'utf8');
  const rows = data.trim().split('\n');
  const headers = rows[0].split(',');
  const jsonData = rows.slice(1).map(row => {
    const values = row.split(',');
    return headers.reduce((obj, header, index) => {
      obj[header.trim()] = values[index].trim();
      return obj;
    }, {});
  });

  return jsonData;
}

export default App;
