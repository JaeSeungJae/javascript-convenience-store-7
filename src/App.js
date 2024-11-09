import fs from 'fs';
import { MissionUtils } from '@woowacourse/mission-utils';

class App {
  async run() {
    try {
      let continueShopping = true;
    const productData = readMeFile('public/products.md'); // 물품 재고
    const promotionData = readMeFile('public/promotions.md'); // 행사 현황
    
    while (continueShopping) {
      entryInform(productData); // 입장 시 출력
      const purchaseItems = await askHowManyBuy(productData); // 구매할 물품
      const checkPromo = checkPromotion(purchaseItems, productData, promotionData); // 구매할 물품의 프로모션 여부 확인
      const compare = comparePromotion(checkPromo, promotionData);
      await askShortageStock(compare);
      await askApplyPromo(compare);
      const memberShip = await askToUseMemberShip();
      printReceipt(compare, productData, memberShip);
      refreshStock(compare, productData);
      continueShopping = await askToContinue();
      }
    }
    catch (error) {
      throw error;
    }
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
  MissionUtils.Console.print('안녕하세요. W편의점입니다.');
  MissionUtils.Console.print('현재 보유하고 있는 상품입니다.');
  const formatter = new Intl.NumberFormat('ko-KR');

  const groupedProducts = productData.reduce((acc, product) => {
    if (!acc[product.name]) acc[product.name] = [];
    acc[product.name].push(product);
    return acc;
  }, {});

  for (const [name, products] of Object.entries(groupedProducts)) {
    let hasNonPromo = false; // 프로모션이 없는 동일 상품이 있는지 확인하는 플래그

    products.forEach(product => {
      let output = `- ${product.name} ${formatter.format(Number(product.price))}원 ${product.quantity}개`;

      if (product.promotion && product.promotion !== 'null') {
        output += ` ${product.promotion}`;
      } else {
        hasNonPromo = true; // 프로모션 없는 상품 존재 시 플래그 설정
      }

      MissionUtils.Console.print(output);
    });

    // 프로모션이 없는 동일 상품이 없으면 "재고 없음" 메시지 추가 출력
    if (!hasNonPromo) {
      const product = products[0]; // 같은 이름의 상품 중 하나를 참조
      MissionUtils.Console.print(`- ${name} ${formatter.format(Number(product.price))}원 재고 없음`);
    }
  }
}

const askHowManyBuy = async (productData) => {
  const input = await MissionUtils.Console.readLineAsync(
    '구매하실 상품명과 수량을 입력해 주세요. (예 : [사이다-2],[감자칩-1])\n'
  );
  try {
    // 올바른 형식 검사
    if (!input.match(/^\[.*?\]$/g)) {
      throw new Error('[ERROR] 올바르지 않은 형식으로 입력했습니다. 다시 입력해 주세요.');
    }
    const items = input.match(/\[.*?\]/g) || [];
    const parsedItems = items.map(item => {
      const [name, quantity] = item.replace(/[\[\]]/g, '').split('-');
      // 수량이 숫자인지 확인
      if (isNaN(Number(quantity))) {
        throw new Error('[ERROR] 올바르지 않은 형식으로 입력했습니다. 다시 입력해 주세요.');
      }
      const requestedQuantity = Number(quantity.trim());
      // 존재하는 상품인지 확인
      const product = productData.find(prod => prod.name === name.trim());
      if (!product) {
        throw new Error('[ERROR] 존재하지 않는 상품입니다. 다시 입력해 주세요.');
      }
      // 재고 수량 검사
      const products = productData.filter(prod => prod.name === name.trim());
      const totalQuantity = products.reduce((sum, prod) => sum + Number(prod.quantity), 0);
      if (requestedQuantity > totalQuantity) {
        throw new Error('[ERROR] 재고 수량을 초과하여 구매할 수 없습니다. 다시 입력해 주세요.');
      }
      const promoQuantity = products
        .filter(prod => prod.promotion && prod.promotion !== 'null')
        .reduce((sum, prod) => sum + Number(prod.quantity), 0);
      let overQuantity = 0;
      if (requestedQuantity > promoQuantity && requestedQuantity <= totalQuantity) {
        overQuantity = requestedQuantity - promoQuantity;
      }
      return {
        name: name.trim(),
        quantity: requestedQuantity,
        overQuantity: overQuantity,
      };
    });

    return parsedItems;
  }
  catch (error) {
    MissionUtils.Console.print(error.message);
    return await askHowManyBuy(productData);
  }
};

const askToUseMemberShip = async () => {
  const input = await MissionUtils.Console.readLineAsync('멤버쉽 할인을 받으시겠습니까? (Y/N)\n');
  return input.trim().toUpperCase() === 'Y';
}

const checkPromotion = (purchaseItems, productData, promotionData) => {
  if (!purchaseItems || purchaseItems.length === 0) {
    throw new Error('[ERROR] 구매 항목이 없습니다.');
  }
  return purchaseItems.map(item => {
    // 해당 상품이 productData에 있는지 찾고, 프로모션 정보가 있는지 확인
    const product = productData.find(prod => prod.name === item.name);
    if (!product) {
      return { ...item, promotion: 'null' };
    }
    // 상품의 프로모션 이름과 promotionData를 비교하여 현재 프로모션 여부를 확인
    const promotion = promotionData.find(promo => promo.name === product.promotion);
    if (promotion) {
      return { ...item, promotion: promotion.name };
    } else {
      item.overQuantity = 0;
      return { ...item, promotion: 'null' };
    }
  });
}

const comparePromotion = (checkPromotion, promotionData) => {
  const currentDate = MissionUtils.DateTimes.now();

  return checkPromotion.map(item => {
    if (item.promotion === 'null') {
      return { ...item, additionalQuantity: 0 }; // 프로모션이 없는 경우 추가 수량 0 반환
    }

    // promotionData에서 해당 프로모션 정보를 찾음
    const promotion = promotionData.find(promo => promo.name === item.promotion);
    
    if (!promotion) {
      return { ...item, additionalQuantity: 0 }; // 해당 프로모션이 없으면 추가 수량 0 반환
    }

    const startDate = new Date(promotion.start_date);
    const endDate = new Date(promotion.end_date);

    if (!(currentDate >= startDate && currentDate <= endDate)) {
      return {...item, additionalQuantity: 0, needAsk: false};
    }

    // buy와 get 조건에 따라 추가 증정 수량을 계산
    const { buy, get } = promotion;
    let additionalQuantity = 0;
    let needAsk = false;
    
    if ((item.quantity - item.overQuantity) % (Number(buy) + Number(get)) === 0) {
      additionalQuantity += ((item.quantity - item.overQuantity) / (Number(buy) + Number(get)));
      needAsk = false;
    }
    else if ((item.quantity - item.overQuantity) > (Number(buy) + Number(get))) {
      additionalQuantity += parseInt((item.quantity - item.overQuantity) / (Number(buy) + Number(get)), 10);
      needAsk = false;
    }
    else if ((item.quantity - item.overQuantity) === Number(buy)) {
      additionalQuantity += Number(get);
      needAsk = true;
    }

    return { ...item, additionalQuantity, needAsk };
  });
}

const askApplyPromo = async (comparePromotion) => {
  for (const item of comparePromotion) {
    if (item.additionalQuantity > 0 && item.needAsk === true) {
      const input = await MissionUtils.Console.readLineAsync(`현재 ${item.name}은(는) ${item.additionalQuantity}개를 무료로 더 받을 수 있습니다. 추가하시겠습니까? (Y/N)\n`);
      if (input.toUpperCase() !== 'Y') {
        item.additionalQuantity = 0;
      }
      else if (input.toUpperCase() === 'Y') {
        item.quantity += item.additionalQuantity;
      }
    }
  }
}

const askShortageStock = async (comparePromotion) => {
  for (const item of comparePromotion) {
    if (item.overQuantity > 0) {
      const input = await MissionUtils.Console.readLineAsync(`현재 ${item.name} ${item.overQuantity}개는 프로모션 할인이 적용되지 않습니다. 그래도 구매하시겠습니까? (Y/N)\n`);
      if (input.toUpperCase() === 'N') {
        item.quantity -= item.overQuantity;
        item.overQuantity = 0;
      }
    }
  }
}

const printReceipt = (comparePromotion, productData, membership) => {
  MissionUtils.Console.print("==============W 편의점================");
  MissionUtils.Console.print("상품명\t\t수량\t금액");

  let totalAmount = 0;
  let eventDiscount = 0;
  let membershipDiscount = 0;

  comparePromotion.forEach(item => {
    const product = productData.find(prod => prod.name === item.name);
    const price = parseInt(product.price, 10);
    const amount = item.quantity * price;
    const isPromo = item.promotion !== 'null';

    // 총 구매 금액에 추가
    totalAmount += amount;

    // 멤버십 할인이 적용되는 경우, 프로모션이 없는 상품에 대해서만 30% 할인
    let discountAmount = 0;
    if (membership && !isPromo) {
      discountAmount = Math.floor(amount * 0.3);
      membershipDiscount += discountAmount;
    }

    const name = item.name.padEnd(8, ' ');
    const quantity = String(item.quantity).padEnd(8, ' ');
    const formattedPrice = amount.toLocaleString('ko-KR'); // 할인 전 금액을 사용하여 출력
    MissionUtils.Console.print(`${name}\t${quantity}\t${formattedPrice}`);

    // 추가 증정에 따른 행사 할인 계산
    if (item.additionalQuantity > 0) {
      const eventDiscountAmount = item.additionalQuantity * price;
      eventDiscount += eventDiscountAmount;
    }
  });

  // 증정 품목 출력
  MissionUtils.Console.print("=============증\t정===============");
  comparePromotion.forEach(item => {
    if (item.additionalQuantity > 0) {
      const name = item.name.padEnd(8, ' ');
      const additionalQuantity = String(item.additionalQuantity).padStart(8, ' ');
      MissionUtils.Console.print(`${name}\t${additionalQuantity}`);
    }
  });

  // 최종 결제 금액 계산 및 출력
  const finalAmount = totalAmount - eventDiscount - membershipDiscount;
  MissionUtils.Console.print("====================================");
  MissionUtils.Console.print(`총구매액\t\t${totalAmount.toLocaleString('ko-KR')}`);
  MissionUtils.Console.print(`행사할인\t\t${eventDiscount > 0 ? `-${eventDiscount.toLocaleString('ko-KR')}` : '0'}`);
  MissionUtils.Console.print(`멤버십할인\t\t${membershipDiscount > 0 ? `-${membershipDiscount.toLocaleString('ko-KR')}` : '0'}`);
  MissionUtils.Console.print(`내실돈\t\t${finalAmount.toLocaleString('ko-KR')}`);
}

const refreshStock = (comparePromotion, productData) => {
  comparePromotion.forEach(item => {
    const product = productData.find(prod => item.name === prod.name);
    const productNoPromo = productData.find(prod => (item.name === prod.name && prod.promotion === 'null'));
    if (product.quantity >= item.quantity) {
      product.quantity -= item.quantity;
    }
    else if (product.quantity < item.quantity) {
      product.quantity = 0;
      productNoPromo.quantity = productNoPromo.quantity - item.overQuantity;
    }
  })
}

const askToContinue = async () => {
  const input = await MissionUtils.Console.readLineAsync('감사합니다. 구매하고 싶은 다른 상품이 있나요? (Y/N)\n');
  return input.trim().toUpperCase() === 'Y';
}




export default App;
