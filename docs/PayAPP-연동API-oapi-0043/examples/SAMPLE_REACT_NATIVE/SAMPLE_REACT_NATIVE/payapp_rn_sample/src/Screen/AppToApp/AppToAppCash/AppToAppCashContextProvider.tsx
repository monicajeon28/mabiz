import React, { createContext, useState, useEffect, useCallback } from 'react';
import { ConstValue } from '~/Define/ConstValue';
import { Linking, Platform } from 'react-native';

interface IAppToAppCashContext {
  trCode?: boolean;
  setTrCode: (trCode: boolean) => void;

  tradeTime?: string;
  setTradeTime: (tradeTime: string) => void;

  idInfo?: string;
  setIdInfo: (idInfo: string) => void;

  name?: string;
  setName: (name: string) => void;

  goodName?: string;
  setGoodName: (goodName: string) => void;

  goodPrice?: string;
  setGoodPrice: (goodPrice: string) => void;

  useTax?: boolean;
  setUseTax: (useTax: boolean) => void;

  svc?: string;
  setSvc: (svc: string) => void;

  email?: string;
  setEmail: (email: string) => void;

  var1?: string;
  setVar1: (var1: string) => void;

  var2?: string;
  setVar2: (var2: string) => void;

  cashstno?: string;
  setCashstno: (cashstno: string) => void;

  reset: () => void;
  cashReceipt: () => void;
  cashReceiptCancel: () => void;
  
  visibleCashReceiptCancelModal?: boolean;
  setVisibleCashReceiptCancelModal: (visibleCashReceiptCancelModal: boolean) => void;
}

const AppToAppCashContext = createContext<IAppToAppCashContext>({
  trCode: undefined,
  setTrCode: (trCode: boolean) => { },

  tradeTime: undefined,
  setTradeTime: (tradeTime: string) => { },

  idInfo: undefined,
  setIdInfo: (idInfo: string) => { },

  name: undefined,
  setName: (name: string) => { },

  goodName: undefined,
  setGoodName: (goodName: string) => { },

  goodPrice: undefined,
  setGoodPrice: (goodPrice: string) => { },

  useTax: undefined,
  setUseTax: (useTax: boolean) => { },

  svc: undefined,
  setSvc: (svc: string) => { },

  email: undefined,
  setEmail: (email: string) => { },

  var1: undefined,
  setVar1: (var1: string) => { },

  var2: undefined,
  setVar2: (var2: string) => { },

  cashstno: undefined,
  setCashstno: (cashstno: string) => { },

  reset: () => { },
  cashReceipt: () => { },
  cashReceiptCancel: () => { },

  visibleCashReceiptCancelModal: undefined,
  setVisibleCashReceiptCancelModal: (visibleCashReceiptCancelModal: boolean) => { },
});

interface Props {
  children: JSX.Element | Array<JSX.Element>;
}

const AppToAppCashContextProvider = ({ children }: Props) => {
  const [trCode, setTrCode] = useState<boolean>(true);
  const [tradeTime, setTradeTime] = useState<string>('');
  const [idInfo, setIdInfo] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [goodName, setGoodName] = useState<string>('');
  const [goodPrice, setGoodPrice] = useState<string>('');
  const [useTax, setUseTax] = useState<boolean>(false);
  const [svc, setSvc] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [var1, setVar1] = useState<string>('');
  const [var2, setVar2] = useState<string>('');
 
  const [cashstno, setCashstno] = useState<string>('');

  const [visibleCashReceiptCancelModal, setVisibleCashReceiptCancelModal] = useState<boolean>(false);

  const reset = (): void => {
    setTrCode(true);
    setTradeTime(currentTime());
    setIdInfo('');
    setName('');
    setGoodName('');
    setGoodPrice('');
    setUseTax(false);
    setSvc('');
    setEmail('');
    setVar1('');
    setVar2('');

    setCashstno('');
  };

  const currentTime = (): string => {
    var date = new Date();
    var yearStr = date.getFullYear().toString();

    var month = date.getMonth() + 1;
    var monthStr = month < 10 ? '0' + month.toString() : month.toString();

    var day = date.getDate();
    var dayStr = day < 10 ? '0' + day.toString() : day.toString();

    var hour = date.getHours();
    var hourStr = hour < 10 ? '0' + hour.toString() : hour.toString();

    var minites = date.getMinutes();
    var minitesStr = minites < 10 ? '0' + minites.toString() : minites.toString();

    var seconds = date.getSeconds();
    var secondsStr = seconds < 10 ? '0' + seconds.toString() : seconds.toString();

    return yearStr + monthStr + dayStr + hourStr + minitesStr + secondsStr;
  }

  /** 사업자만 현금영수증 발행이 가능하며, 개인은 불가능합니다.
   * 현금영수증 발행
   * reqType : 발행 = CASH_RECEIPT
   * returnUri : 리턴받을 고객사 앱 URI
   * trCode : 소득공제용: 0, 지출증빙용: 1
   * tradeTime : 원거래시각 [YYYYMMDDHHMMSS]
   * idInfo : 소득공제용 발행 시: 휴대폰번호 / 지출증빙용 발행 시: 사업자번호
   * name : 구매자 또는 사업자 명
   * goodName : 상품명
   * goodPrice : 발행 요청 금액
   * email : 주문자 이메일
   * svc : 봉사료
   * hasTax : 과세/면세 [과세:1, 면세:0]
   * var1, var2 : 임의 사용 변수 1, 2
   */
  const cashReceipt = () => {
    var param = '';

    param += ConstValue.DEEP_LINK;
    param += '?reqType=' + 'CASH_RECEIPT';
    param += '&returnUri=' + ConstValue.RETURN_URI;
    param += '&trCode=' + (trCode ? '0' : '1');
    param += '&tradeTime=' + tradeTime;
    param += '&idInfo=' + idInfo;
    param += '&name=' + name;
    param += '&goodName=' + goodName;
    param += '&goodPrice=' + goodPrice;
    param += '&email=' + email;
    param += '&svc=' + svc;
    param += '&hasTax=' + (useTax ? ConstValue.TRUE : ConstValue.FALSE);
    param += '&var1=' + var1;
    param += '&var2=' + var2;

    openApp(param);
  };

  /**
   * 현금영수증 발행 취소
   * reqType : 취소 = CASH_RECEIPT_CANCEL
   * returnUri : 리턴받을 고객사 앱 URI
   * cashstno : 현금영수증 발행 번호
   * var1, var2 : 임의 사용 변수 1, 2
   */
  const cashReceiptCancel = () => {
    var param = '';

    param += ConstValue.DEEP_LINK;
    param += '?reqType=' + 'CASH_RECEIPT_CANCEL';
    param += '&returnUri=' + ConstValue.RETURN_URI;
    param += '&cashstno=' + cashstno;
    param += '&var1=' + var1;
    param += '&var2=' + var2;

    setCashstno('');
    setVisibleCashReceiptCancelModal(false);
    openApp(param);
  };

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
    <AppToAppCashContext.Provider
      value={{
        trCode,
        setTrCode,
        tradeTime,
        setTradeTime,
        idInfo,
        setIdInfo,
        name,
        setName,
        goodName,
        setGoodName,
        goodPrice,
        setGoodPrice,
        useTax,
        setUseTax,
        svc,
        setSvc,
        email,
        setEmail,
        var1,
        setVar1,
        var2,
        setVar2,
        cashstno,
        setCashstno,
        reset,
        cashReceipt,
        cashReceiptCancel,
        visibleCashReceiptCancelModal,
        setVisibleCashReceiptCancelModal,
      }}>
      {children}
    </AppToAppCashContext.Provider>
  );
};

export { AppToAppCashContextProvider, AppToAppCashContext };
