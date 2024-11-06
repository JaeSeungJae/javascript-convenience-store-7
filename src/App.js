import fs from 'fs';
import { MissionUtils } from '@woowacourse/mission-utils';

class App {
  async run() {
    const productData = readMeFile('public/products.md');
    const promotionData = readMeFile('public/promotions.md');


    console.log(productData);
    console.log(promotionData);
    entryInform(productData);
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

const entryInform = (productData) => {
  console.log('안녕하세요. W편의점입니다.');
  console.log('현재 보유하고 있는 상품입니다.');
  const formatter = new Intl.NumberFormat('ko-KR');
  for (let i = 0; i < productData.length; i++) {
    let output = `- ${productData[i].name} ${formatter.format(Number(productData[i].price))}원 ${productData[i].quantity}개`;

    if (productData[i].promotion && productData[i].promotion !== 'null') {
      output += ` ${productData[i].promotion}`;
    }
    console.log(output);
  }
  
}



export default App;
