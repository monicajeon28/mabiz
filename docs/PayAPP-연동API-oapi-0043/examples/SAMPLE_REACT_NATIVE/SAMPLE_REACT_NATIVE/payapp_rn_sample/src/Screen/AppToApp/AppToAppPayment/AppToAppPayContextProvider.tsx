import React, { createContext, useState, useEffect, useCallback } from 'react';
import { ConstValue } from '~/Define/ConstValue';
import { Linking, Platform } from 'react-native';

interface IAppToAppPayContext {
  customerPhone?: string;
  setCustomerPhone: (customerPhone: string) => void;

  goodName?: string;
  setGoodName: (goodName: string) => void;

  price?: string;
  setPrice: (price: string) => void;

  cardinst?: Number;
  setCardinst: (cardinst: Number) => void;

  useTax?: boolean;
  setUseTax: (useTax: boolean) => void;


  isAllPayReqType?: boolean;
  setIsAllPayReqType: (isAllPayReqType: boolean) => void;


  var1?: string;
  setVar1: (var1: string) => void;

  var2?: string;
  setVar2: (var2: string) => void;

  reset: () => void;
  payRequest: (reqType: string) => void;
}

const AppToAppPayContext = createContext<IAppToAppPayContext>({
  customerPhone: undefined,
  setCustomerPhone: (customerPhone: string) => { },

  goodName: undefined,
  setGoodName: (goodName: string) => { },

  price: undefined,
  setPrice: (price: string) => { },

  cardinst: undefined,
  setCardinst: (cardinst: Number) => { },

  useTax: undefined,
  setUseTax: (useTax: boolean) => { },


  isAllPayReqType: undefined,
  setIsAllPayReqType: (isAllPayReqType: boolean) => { },


  var1: undefined,
  setVar1: (var1: string) => { },

  var2: undefined,
  setVar2: (var2: string) => { },

  reset: () => { },

  payRequest: (reqType: string) => { }
});

interface Props {
  children: JSX.Element | Array<JSX.Element>;
}

const AppToAppPayContextProvider = ({ children }: Props) => {
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [goodName, setGoodName] = useState<string>('테스트 상품');
  const [price, setPrice] = useState<string>('1000');
  const [cardinst, setCardinst] = useState<Number>(1);
  const [useTax, setUseTax] = useState<boolean>(false);
  const [isAllPayReqType, setIsAllPayReqType] = useState<boolean>(false);
  const [var1, setVar1] = useState<string>('');
  const [var2, setVar2] = useState<string>('');




  const reset = (): void => {
    setCustomerPhone('');
    setGoodName('테스트 상품');
    setPrice('1000');
    setUseTax(false);
    setVar1('');
    setVar2('');
  };



  const payRequest = (reqType: string) => {
    openApp(makeParameter(reqType));
  };

  /**
   * 
   * 원격결제 및 대면결제
   * reqType : 원격결제 = REMOTE
   *           카메라 = OCR
   *           수기 = MANUAL
   *           네이버페이 = NAVER_PAY
   *           카카오페이 = KAKAO_PAY
   *           스마일페이 = SMILE_PAY
   *           애플페이 = APPLE_PAY
   *           페이코 = PAYCO          
   *           위챗페이 = WECHAT_PAY
   *           내통장결제 = MY_ACCOUNT
   *           내통장결제 = TOSS_PAY
   *           QR = QR
   *           NFC = NFC (iOS 미지원)
   *           삼성페이 = SAMSUNG (iOS 미지원)
   * returnUri : 리턴받을 고객사 앱 URI
   * phoneNumber : 수신 전화번호 (* 원격결제 필수, * 대면결제 10만원 이상 시 필수)
   * goodName : 상품명
   * goodPrice : 상품 가격 (* 1,000원이상 부터 가능, 내통장결제는 10,000원 부터 가능)
   * cardinst : 할부 [1~12] * 5만원 이상부터 가능 (카메라, 수기) 미입력 시 일시불
   * hasTax : 과세/면세 [과세:1, 면세:0] * 개인인 경우 면세
   * isAllPayReqType : 모든 대면결제 타입 사용 [사용:1, 미사용:0]
   * feedbackurl : 결제 결과 값을 받을 고객사 URL (결과값을 받아 DB에 저장한다. 공통 통보 URL 등록 시 중복 호출되니, 중복처리 되지 않도록 mul_no를 이용하여 중복 방지.)
   * checkretry : feedbackurl 재시도 [y:재시도,n:재시도 안함]
   * var1, var2 : 임의 사용 변수 1, 2
   */
  const makeParameter = (reqType: string) => {
    var param = '';

    param += ConstValue.DEEP_LINK;
    param += '?reqType=' + reqType;
    param += '&returnUri=' + ConstValue.RETURN_URI;
    param += '&phoneNumber=' + customerPhone;
    param += '&goodName=' + goodName;
    param += '&goodPrice=' + price;
    param += addCardinst(reqType);
    param += '&hasTax=' + (useTax ? '1' : '0');
    param += addIsAllPayReqType(reqType);   
    param += '&feedbackurl=' + ConstValue.FEEDBACK_URL;
    param += '&checkretry=' + 'y';
    param += '&var1=' + var1;
    param += '&var2=' + var2;

    return param;
  };

  const addCardinst = (reqType: string) => {
    var param = '';
    if (reqType == 'OCR' || 
        reqType == 'MANUAL' || 
        reqType == 'NFC' || 
        reqType == 'SAMSUNG') {
      param += '&cardinst=' + cardinst;    
    }
    return param;
  }

  const addIsAllPayReqType = (reqType: string) => {
    var param = '';
    if (reqType == 'OCR' ||        
        reqType == 'MANUAL' ||
        reqType == 'NAVER_PAY' ||
        reqType == 'KAKAO_PAY' ||
        reqType == 'SMILE_PAY' ||
        reqType == 'APPLE_PAY' ||
        reqType == 'PAYCO' ||
        reqType == 'WECHAT_PAY' ||
        reqType == 'MY_ACCOUNT' ||
        reqType == 'TOSS_PAY' ||
        reqType == 'QR' ||
        reqType == 'NFC' ||      
        reqType == 'SAMSUNG') {
      param += '&isAllPayReqType=' + (isAllPayReqType ? '1' : '0');         
    }
    return param;
  }
 
  const openApp = (param: string) => {
    Linking.canOpenURL(param).then(supported => {
      if (supported) {
        Linking.openURL(param);
      } else {
        Linking.openURL(Platform.OS === 'ios' ? ConstValue.PAYAPP_iOS_STORE : ConstValue.PAYAPP_AOS_STORE);
      }
    });
  };

  return (
    <AppToAppPayContext.Provider
      value={{
        customerPhone,
        setCustomerPhone,
        goodName,
        setGoodName,
        price,
        setPrice,
        cardinst,
        setCardinst,
        useTax,
        setUseTax,
        isAllPayReqType,
        setIsAllPayReqType,
        var1,
        setVar1,
        var2,
        setVar2,
        reset,
        payRequest
      }}>
      {children}
    </AppToAppPayContext.Provider>
  );
};

export { AppToAppPayContextProvider, AppToAppPayContext };
