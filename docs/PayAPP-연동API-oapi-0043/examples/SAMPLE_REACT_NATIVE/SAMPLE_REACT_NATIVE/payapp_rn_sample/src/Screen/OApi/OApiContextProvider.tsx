import React, { createContext, useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import * as OApiSv from '~/Model/SV/OApiSv';
import { ConstValue } from '~/Define/ConstValue';
import { Alert } from 'react-native';
import Toast from 'react-native-simple-toast';
import moment from 'moment';

import { CashStCancelData } from '~/Model/CashStCancelData';
import { CashStRegistData } from '~/Model/CashStRegistData';
import { CheckNpayCashReceiptReqData } from '~/Model/CheckNpayCashReceiptReqData';
import { PayRequestData } from '~/Model/PayRequestData';
import { RebillCancelData } from '~/Model/RebillCancelData';
import { PayCancelData } from '~/Model/PayCancelData';
import { PayCancelReqData } from '~/Model/PayCancelReqData';
import { RebillRegistData } from '~/Model/RebillRegistData';
import { RebillStartData } from '~/Model/RebillStartData';
import { RebillStopData } from '~/Model/RebillStopData';
import { SellerRegistData } from '~/Model/SellerRegistData';
import { SubidRegistData } from '~/Model/SubidRegistData';
import { UseridCheckData } from '~/Model/UseridCheckData';
import { BillRegisterData } from '~/Model/BillRegisterData';
import { BillDeleteData } from '~/Model/BillDeleteData';
import { BillPaymentData } from '~/Model/BillPaymentData';
import { BillResponseData } from '~/Model/BillResponseData';
import { BillDataDAO } from '~/Model/BillDataDAO';

interface IOApiContext {
  /**************************************
   * Payapp_OAPI 앱 사용을 위한 필수값 체크
   *************************************/

  /** 페이앱 아이디 */
  userId?: string;
  setUserID: (userId: string) => void;

  /** 연동 KEY, 해당 링크에서 가져오세요. [https://seller.payapp.kr/c/apiconnect_info] */
  linkKey?: String;
  setLinkKey: (linkKey: string) => void;

  /** 전화번호 */
  recvphone?: string;
  setRecvPhone: (recvphone: string) => void;

  /** 이메일 */
  email?: string;
  setEmail: (email: string) => void;

  /** 정기결제 요청 날짜(*오늘 이후 날짜) 0000-00-00 */
  rebillExpire?: string;
  setRebillExpire: (rebillExpire: string) => void;

  // *** 결제회원(Bill) ***
  billDataArray?: BillDataDAO[];
  setBillDataArray: (billData: BillDataDAO[]) => void;

  cardNo?: string;
  setCardNo: (cardNo: string) => void;
  // 카드 비밀번호 앞 두자리
  cardPw?: string;
  setCardPw: (cardPw: string) => void;

  // 카드 유효기간(월)
  expMonth?: string;
  setExpMonth: (expMonth: string) => void;
  // 카드 유효기간(년)
  expYear?: string;
  setExpYear: (expYear: string) => void;

  // 구매자확인 개인: 생년월일(YYMMDD) 6자리. 사업자번호
  buyerAuthNo?: string;
  setBuyerAuthNo: (buyerAuthNo: string) => void;

  // 구매자 전화번호
  buyerPhone?: string;
  setBuyerPhone: (buyerPhone: string) => void;
  // 구매자 성함
  buyerName?: string;
  setBuyerName: (buyerName: string) => void;
  // *** Bill end ***

  /** mul_no, rebill_no, cashstno는 샘플앱을 원활하게 구동을 위한 변수입니다. */
  // 결제요청번호
  mul_no?: string;
  setMulNo: (mul_no: string) => void;
  // 정기결제 등록번호
  rebill_no?: string;
  setRebillNo: (rebill_no: string) => void;
  // 현금영수증 발행번호
  cashstno?: string;
  setCashstNo: (cashstno: string) => void;

  reset: () => void;
  resetModal: () => void;

  visibleRegisterModal?: boolean;
  setVisibleRegisterModal: (visibleRegisterModal: boolean) => void;
  visibleListModal?: boolean;
  setVisibleListModal: (visibleListModal: boolean) => void;

  payReqeust: () => void;
  payCancel: () => void;
  payCancelReq: () => void;
  rebillRegist: () => void;
  rebillCancel: () => void;
  rebillStop: () => void;
  rebillStart: () => void;
  sellerRegist: () => void;
  useridCheck: () => void;
  subidRegist: () => void;
  cashStRegist: () => void;
  cashStCancel: () => void;
  checkNpayCashReceiptReq: () => void;
  billRegister: () => void;
  billDelete: (billDataDAO: BillDataDAO) => void;
  billPayment: (billDataDAO: BillDataDAO) => void;
}

const OApiContext = createContext<IOApiContext>({
  userId: undefined,
  setUserID: (userId: string) => { },

  linkKey: undefined,
  setLinkKey: (linkKey: string) => { },

  recvphone: undefined,
  setRecvPhone: (recvphone: string) => { },

  email: undefined,
  setEmail: (email: string) => { },

  rebillExpire: undefined,
  setRebillExpire: (rebillExpire: string) => { },

  billDataArray: undefined,
  setBillDataArray: (billData: BillDataDAO[]) => { },

  cardNo: undefined,
  setCardNo: (cardNo: string) => { },
  cardPw: undefined,
  setCardPw: (cardPw: string) => { },

  expMonth: undefined,
  setExpMonth: (expMonth: string) => { },
  expYear: undefined,
  setExpYear: (expYear: string) => { },

  buyerAuthNo: undefined,
  setBuyerAuthNo: (buyerAuthNo: string) => { },
  buyerPhone: undefined,
  setBuyerPhone: (buyerPhone: string) => { },
  buyerName: undefined,
  setBuyerName: (buyerName: string) => { },

  mul_no: undefined,
  setMulNo: (mul_no: string) => { },

  rebill_no: undefined,
  setRebillNo: (rebill_no: string) => { },

  cashstno: undefined,
  setCashstNo: (cashstno: string) => { },

  reset: () => { },
  resetModal: () => { },

  visibleRegisterModal: undefined,
  setVisibleRegisterModal: (visibleRegisterModal: boolean) => { },
  visibleListModal: undefined,
  setVisibleListModal: (visibleListModal: boolean) => { },

  payReqeust: () => { },
  payCancel: () => { },
  payCancelReq: () => { },
  rebillRegist: () => { },
  rebillCancel: () => { },
  rebillStop: () => { },
  rebillStart: () => { },
  sellerRegist: () => { },
  useridCheck: () => { },
  subidRegist: () => { },
  cashStRegist: () => { },
  cashStCancel: () => { },
  checkNpayCashReceiptReq: () => { },
  billRegister: () => { },
  billDelete: (billDataDAO: BillDataDAO) => { },
  billPayment: (billDataDAO: BillDataDAO) => { },
});

interface Props {
  children: JSX.Element | Array<JSX.Element>;
}

const OApiContextProvider = ({ children }: Props) => {
  const [userId, setUserID] = useState<string>('');
  const [linkKey, setLinkKey] = useState<string>('');
  const [recvphone, setRecvPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [rebillExpire, setRebillExpire] = useState<string>('');

  const [billDataArray, setBillDataArray] = useState<BillDataDAO[]>([]);

  const [cardNo, setCardNo] = useState<string>('');
  const [cardPw, setCardPw] = useState<string>('');

  const [expMonth, setExpMonth] = useState<string>('');
  const [expYear, setExpYear] = useState<string>('');

  const [buyerAuthNo, setBuyerAuthNo] = useState<string>('');
  const [buyerPhone, setBuyerPhone] = useState<string>('');
  const [buyerName, setBuyerName] = useState<string>('');

  const [mul_no, setMulNo] = useState<string>('');
  const [rebill_no, setRebillNo] = useState<string>('');
  const [cashstno, setCashstNo] = useState<string>('');

  const [visibleRegisterModal, setVisibleRegisterModal] = useState<boolean>(false);
  const [visibleListModal, setVisibleListModal] = useState<boolean>(false);

  const navigation = useNavigation();

  const reset = (): void => {
    setUserID('');
    setLinkKey('');
    setRecvPhone('');
    setEmail('');
    setRebillExpire('');

    resetModal()
  };

  const resetModal = (): void => {
    setCardNo('');
    setExpMonth('');
    setExpYear('');
    setBuyerAuthNo('');
    setCardPw('');
    setBuyerPhone('');
    setBuyerName('');
  }

  useEffect(() => {
    if (rebillExpire.length === 0) {
      const date = new Date(+new Date() + 3240 * 10000)
        .toISOString()
        .split('T')[0];
      setRebillExpire(date);
    }
  });

  const showAlert = (title: string, body: string) => {
    Alert.alert(title, body, [{ text: '확인' }]);
  };

  // * 결제 Fucntion *
  /**     
     * 결제 요청 시나리오 1 (구매자 핸드폰으로 결제 URL을 보내 결제를 요청한다.)
     * 
     * // 결제 요청 (SMS, WEB, URL)
     * payRequest() 함수로 결제 링크 생성 및 구매자 핸드폰으로 결제 링크 전송 -> 구매자 결제
     *
     * smsuse: "y"           - 구매자에게 결제 문자를 보낸다.
     * feedbackurl: ""       - 결제 결과 값을 받을 고객사 URL (결과값을 받아 DB에 저장한다.)
     **************************************************************************************************************************************

     * 결제 요청 시나리오 2 (결제 URL을 앱 내 WebView에 띄워 결제를 유도한다.)
     * payRequest() 함수로 결제 링크 생성 -> WebView로 링크 실행 -> 결제 진행 -> 결제앱으로 이동하여 인증 -> WebView로 돌아와 내부적으로 결제 처리 -> Skip_cstpage에 따라 '결제 전표' 이동 또는 'Returnurl' 이동
     *
     * smsuse: "n"           - 구매자에게 결제 문자를 보내지 않는다.
     * feedbackurl: ""       - 결제 결과 값을 받을 고객사 URL (결과값을 받아 DB에 저장한다. 공통 통보 URL 등록 시 중복 호출되니, 중복처리 되지 않도록 mul_no, var1, var2를 이용하여 중복 방지.)
     * skip_cstpage: "y"     - 'y' : 매출 전표 이동 없이 바로 Returnurl로 이동 (결제 데이터를 POST로 전송, 보안을 위해 결제완료 DB처리는 feedbackurl 에서 한다.)
     *                         'n' : 매출 전표로 이동 (결제 데이터 전송 안 함, 확인 버튼 클릭시 Returnurl로 이동)
     * returnurl: ""         - 결제 완료 후 이동 할 화면 URL. ex)앱제작사의 커스텀 매출전표, 결제 완료 화면
     *                         페이앱 연동은 끝났습니다. 해당 페이지에서 Javascript 또는 네이티브로 앱을 컨트롤 하세요.
     **************************************************************************************************************************************
     */
  // 결제 요청 (SMS, WEB, URL)
  const payReqeust = () => {
    if (userId.length === 0) {
      Toast.show('유저 아이디를 확인해주세요.', Toast.SHORT);
      return;
    }

    const payRequestData = new PayRequestData();
    payRequestData.cmd = ConstValue.CMD_PAY_REQUEST;
    payRequestData.userid = userId;    
    payRequestData.goodname = '테스트 상품';
    payRequestData.price = '1000';
    payRequestData.recvphone = recvphone;    
    payRequestData.smsuse = 'n';

    OApiSv.payReqeust(payRequestData).then(response => {
      showAlert('결과', decodeURIComponent(response.data));
      const jsonData = queryStringToJSON(response.data);
      if (jsonData.state === ConstValue.SUCCESS) {
        setMulNo(jsonData.mul_no);
        navigation.navigate('WebViewScreen', { 'url': jsonData.payurl });
      }
    });
  };

  /**
   * 결제(요청, 승인) 취소
   * @returns 
   */
  const payCancel = () => {
    if (mul_no.length === 0) {
      Toast.show('mul_no 를 확인해주세요.', Toast.SHORT);
      return;
    }

    if (linkKey.length === 0) {
      Toast.show('연동 키를 확인해주세요.', Toast.SHORT);
      return;
    }

    const payCancelReqData = new PayCancelData();
    payCancelReqData.cmd = ConstValue.CMD_PAY_CANCEL;
    payCancelReqData.userid = userId;
    payCancelReqData.linkkey = linkKey;
    payCancelReqData.mul_no = mul_no;

    OApiSv.payCancel(payCancelReqData).then(response => {
      showAlert('결과', decodeURIComponent(response.data));
      const jsonData = queryStringToJSON(response.data);
      if (jsonData.state === ConstValue.SUCCESS) {
        setMulNo('');
      }
    });
  };

  /**
   * 결제 취소 요청 (결제승인 후 D+5일이 경과 되었거나, 판매자 정산이 완료된 경우)
   * @returns 
   */
  const payCancelReq = () => {
    if (mul_no.length === 0) {
      Toast.show('mul_no 를 확인해주세요.', Toast.SHORT);
      return;
    }

    if (linkKey.length === 0) {
      Toast.show('연동 키를 확인해주세요.', Toast.SHORT);
      return;
    }

    const payCancelReqData = new PayCancelReqData();
    payCancelReqData.cmd = ConstValue.CMD_PAY_CANCEL_REQ;
    payCancelReqData.userid = userId;
    payCancelReqData.linkkey = linkKey;
    payCancelReqData.mul_no = mul_no;
    payCancelReqData.cancelmemo = '취소 메모';

    OApiSv.payCancelReq(payCancelReqData).then(response => {
      showAlert('결과', decodeURIComponent(response.data));
      const jsonData = queryStringToJSON(response.data);
      if (jsonData.state === ConstValue.SUCCESS) {
        setMulNo('');
      }
    });
  };

  /**
   * 정기 결제 요청
   * @returns 
   */
  const rebillRegist = () => {
    if (userId.length === 0) {
      Toast.show('유저 아이디를 확인해주세요.', Toast.SHORT);
      return;
    }

    if (recvphone.length === 0) {
      Toast.show('고객전화번호를 확인해주세요.', Toast.SHORT);
      return;
    }

    if (rebillExpire.length === 0) {
      Toast.show('결제 요청일을 확인해주세요.', Toast.SHORT);
      return;
    }

    const rebillRegistData = new RebillRegistData();
    rebillRegistData.cmd = ConstValue.CMD_REBILL_REGIST;
    rebillRegistData.userid = userId;
    rebillRegistData.goodname = '정기결제 상품명';
    rebillRegistData.goodprice = '1000';
    rebillRegistData.recvphone = recvphone;
    rebillRegistData.rebillCycleType = 'Month';
    rebillRegistData.rebillExpire = rebillExpire;

    OApiSv.rebillRegist(rebillRegistData).then(response => {
      showAlert('결과', decodeURIComponent(response.data));
      const jsonData = queryStringToJSON(response.data);
      if (jsonData.state === ConstValue.SUCCESS) {
        setRebillNo(jsonData.rebill_no);
      }
    });
  };

  /**
   * 정기 결제 해지
   * @returns 
   */
  const rebillCancel = () => {
    if (userId.length === 0) {
      Toast.show('유저 아이디를 확인해주세요.', Toast.SHORT);
      return;
    }

    if (rebill_no.length === 0) {
      Toast.show('rebill_no 를 확인해주세요.', Toast.SHORT);
      return;
    }

    if (linkKey.length === 0) {
      Toast.show('연동 키를 확인해주세요.', Toast.SHORT);
      return;
    }

    const rebillCancelData = new RebillCancelData();
    rebillCancelData.cmd = ConstValue.CMD_REBILL_CANCEL;
    rebillCancelData.userid = userId;
    rebillCancelData.rebill_no = rebill_no;
    rebillCancelData.linkkey = linkKey;

    OApiSv.rebillCancel(rebillCancelData).then(response => {
      showAlert('결과', decodeURIComponent(response.data));
      const jsonData = queryStringToJSON(response.data);
      if (jsonData.state === ConstValue.SUCCESS) {
        setRebillNo('');
      }
    });
  };

  /**
   * 정기 결제 일시 정지
   * @returns 
   */
  const rebillStop = () => {
    if (userId.length === 0) {
      Toast.show('유저 아이디를 확인해주세요.', Toast.SHORT);
      return;
    }

    if (rebill_no.length === 0) {
      Toast.show('rebill_no 를 확인해주세요.', Toast.SHORT);
      return;
    }

    if (linkKey.length === 0) {
      Toast.show('연동 키를 확인해주세요.', Toast.SHORT);
      return;
    }

    const rebillStopData = new RebillStopData();
    rebillStopData.cmd = ConstValue.CMD_REBILL_STOP;
    rebillStopData.userid = userId;
    rebillStopData.rebill_no = rebill_no;
    rebillStopData.linkkey = linkKey;

    OApiSv.rebillStop(rebillStopData).then(response => {
      showAlert('결과', decodeURIComponent(response.data));
      const jsonData = queryStringToJSON(response.data);
      if (jsonData.state === ConstValue.SUCCESS) {
        // code
      }
    });
  };

  /**
   * 정기 결제 승인
   * @returns 
   */
  const rebillStart = () => {
    if (userId.length === 0) {
      Toast.show('유저 아이디를 확인해주세요.', Toast.SHORT);
      return;
    }

    if (rebill_no.length === 0) {
      Toast.show('rebill_no 를 확인해주세요.', Toast.SHORT);
      return;
    }

    if (linkKey.length === 0) {
      Toast.show('연동 키를 확인해주세요.', Toast.SHORT);
      return;
    }

    const rebillStartData = new RebillStartData();
    rebillStartData.cmd = ConstValue.CMD_REBILL_START;
    rebillStartData.userid = userId;
    rebillStartData.rebill_no = rebill_no;
    rebillStartData.linkkey = linkKey;

    OApiSv.rebillStart(rebillStartData).then(response => {
      showAlert('결과', decodeURIComponent(response.data));
      const jsonData = queryStringToJSON(response.data);
      if (jsonData.state === ConstValue.SUCCESS) {
        // code
      }
    });
  };

  /**
   * 판매자 회원 가입
   * @returns 
   */
  const sellerRegist = () => {
    if (userId.length === 0) {
      Toast.show('유저 아이디를 확인해주세요.', Toast.SHORT);
      return;
    }

    if (recvphone.length === 0) {
      Toast.show('고객전화번호를 확인해주세요.', Toast.SHORT);
      return;
    }

    if (email.length === 0) {
      Toast.show('이메일을 확인해주세요.', Toast.SHORT);
      return;
    }

    const sellerRegistData = new SellerRegistData();
    sellerRegistData.cmd = ConstValue.CMD_SELLER_REGIST;
    sellerRegistData.userid = userId;
    sellerRegistData.userpwd = 'asdf1234';
    sellerRegistData.sellername = 'newUserName';
    sellerRegistData.phone = recvphone;
    sellerRegistData.email = email;
    sellerRegistData.bizkind = '서비스구분';
    sellerRegistData.usertype = '1'; // 판매자 구분 (개인:1, 사업자:2)
    sellerRegistData.resellerid = 'resellerid';
    sellerRegistData.join_type = '0';
    sellerRegistData.seller_type = 'seller';
    sellerRegistData.username = 'userName'; // (개인 필수)
    // sellerRegistData.compregno = '사업자등록번호'; // (사업자 필수)
    // sellerRegistData.compname = '상호명'; // (사업자 필수)
    // sellerRegistData.biztype1 = '업태'; // (사업자 필수)
    // sellerRegistData.biztype2 = '업종'; // (사업자 필수)
    // sellerRegistData.ceo_nm = '대표자 성함'; // (사업자 필수)

    OApiSv.sellerRegist(sellerRegistData).then(response => {
      showAlert('결과', decodeURIComponent(response.data));
      const jsonData = queryStringToJSON(response.data);
      if (jsonData.state === ConstValue.SUCCESS) {
        // code
      }
    });
  };

  /**
   * 판매자 아이디 중복 체크
   * @returns 
   */
  const useridCheck = () => {
    if (userId.length === 0) {
      Toast.show('유저 아이디를 확인해주세요.', Toast.SHORT);
      return;
    }

    const useridCheckData = new UseridCheckData();
    useridCheckData.cmd = ConstValue.CMD_USER_ID_CHECK;
    useridCheckData.userid = userId;
    useridCheckData.resellerid = 'resellerid';

    OApiSv.useridCheck(useridCheckData).then(response => {
      showAlert('결과', decodeURIComponent(response.data));
      const jsonData = queryStringToJSON(response.data);
      if (jsonData.state === ConstValue.SUCCESS) {
        // code
      }
    });
  };

  /**
   * 부계정 등록
   * @returns 
   */
  const subidRegist = () => {
    if (userId.length === 0) {
      Toast.show('유저 아이디를 확인해주세요.', Toast.SHORT);
      return;
    }

    const subidRegistData = new SubidRegistData();
    subidRegistData.cmd = ConstValue.CMD_SUB_ID_REGIST;
    subidRegistData.userid = userId;
    subidRegistData.subuserid = 'subuserid';
    subidRegistData.subpwd = 'asdf1234';
    subidRegistData.subname = 'subname';

    OApiSv.subidRegist(subidRegistData).then(response => {
      showAlert('결과', decodeURIComponent(response.data));
      const jsonData = queryStringToJSON(response.data);
      if (jsonData.state === ConstValue.SUCCESS) {
        // code
      }
    });
  };

  /**
   * 현금영수증 발행
   * @returns 
   */
  const cashStRegist = () => {
    if (userId.length === 0) {
      Toast.show('유저 아이디를 확인해주세요.', Toast.SHORT);
      return;
    }

    if (recvphone.length === 0) {
      Toast.show('고객전화번호를 확인해주세요.', Toast.SHORT);
      return;
    }

    if (linkKey.length === 0) {
      Toast.show('연동 키를 확인해주세요.', Toast.SHORT);
      return;
    }

    const cashStRegistData = new CashStRegistData();
    cashStRegistData.cmd = ConstValue.CMD_CASH_ST_REGIST;
    cashStRegistData.userid = userId;
    cashStRegistData.linkkey = linkKey;
    cashStRegistData.good_name = '상품명';
    cashStRegistData.buyr_name = '구매자명';
    cashStRegistData.id_info = recvphone;
    cashStRegistData.trad_time = moment(new Date()).format('yyyyMMDDHHmmss');
    cashStRegistData.tr_code = '0';
    cashStRegistData.amt_tot = '2000';
    cashStRegistData.amt_sup = '0';
    cashStRegistData.amt_svc = '0';
    cashStRegistData.amt_tax = '0';
    cashStRegistData.corp_tax_type = 'TG01';

    OApiSv.cashStRegist(cashStRegistData).then(response => {
      showAlert('결과', decodeURIComponent(response.data));
      const jsonData = queryStringToJSON(response.data);
      if (jsonData.state === ConstValue.SUCCESS) {
        setCashstNo(jsonData.cashstno);
      }
    });
  };

  /**
   * 현금영수증 발행 취소
   * @returns 
   */
  const cashStCancel = () => {
    if (userId.length === 0) {
      Toast.show('유저 아이디를 확인해주세요.', Toast.SHORT);
      return;
    }

    if (cashstno.length === 0) {
      Toast.show('cashstno 를 확인해주세요.', Toast.SHORT);
      return;
    }

    if (linkKey.length === 0) {
      Toast.show('연동 키를 확인해주세요.', Toast.SHORT);
      return;
    }

    const cashStCancelData = new CashStCancelData();
    cashStCancelData.cmd = ConstValue.CMD_CASH_ST_CANCEL;
    cashStCancelData.userid = userId;
    cashStCancelData.linkkey = linkKey;
    cashStCancelData.cashstno = cashstno;

    OApiSv.cashStCancel(cashStCancelData).then(response => {
      showAlert('결과', decodeURIComponent(response.data));
      const jsonData = queryStringToJSON(response.data);
      if (jsonData.state === ConstValue.SUCCESS) {
        setCashstNo('');
      }
    });
  };

  /**
  * 네이버페이 현금 영수증 발행 대상 금액 조회
    - 네이버페이로 결제된 주문건만 조회 가능합니다.
  * @returns 
  */
  const checkNpayCashReceiptReq = () => {
    if (userId.length === 0) {
      Toast.show('유저 아이디를 확인해주세요.', Toast.SHORT);
      return;
    }

    if (mul_no.length === 0) {
      Toast.show('mul_no 를 확인해주세요.', Toast.SHORT);
      return;
    }

    const checkNpayCashReceiptReqData = new CheckNpayCashReceiptReqData();
    checkNpayCashReceiptReqData.cmd = ConstValue.CMD_CHECK_NPAY_CASH_RECEIPT_REQ;
    checkNpayCashReceiptReqData.userid = userId;
    checkNpayCashReceiptReqData.mul_no = mul_no;

    OApiSv.checkNpayCashReceiptReq(checkNpayCashReceiptReqData).then(response => {
      showAlert('결과', decodeURIComponent(response.data));
      const jsonData = queryStringToJSON(response.data);
      if (jsonData.state === ConstValue.SUCCESS) {
      }
    });
  };

  /**
   * Bill결제 등록 
   * @returns 
   */
  const billRegister = () => {
    if (userId.length === 0) {
      Toast.show('유저 아이디를 확인해주세요.', Toast.SHORT);
      return;
    }

    if (cardNo.length === 0) {
      Toast.show('카드번호를 확인해주세요.', Toast.SHORT);
      return
    }

    if (expMonth.length === 0) {
      Toast.show('유효기간(월)을 확인해주세요.', Toast.SHORT);
      return
    }

    if (expYear.length === 0) {
      Toast.show('유효기간(년)을 확인해주세요.', Toast.SHORT);
      return
    }

    if (buyerAuthNo.length === 0) {
      Toast.show('인증번호를 확인해주세요.', Toast.SHORT);
      return
    }

    if (cardPw.length === 0) {
      Toast.show('카드 비밀번호를 확인해주세요.', Toast.SHORT);
      return
    }

    if (buyerPhone.length === 0) {
      Toast.show('구매자 전화번호를 확인해주세요.', Toast.SHORT);
      return
    }

    if (buyerName.length === 0) {
      Toast.show('구매자 성함을 확인해주세요.', Toast.SHORT);
      return
    }

    const billRegisterData = new BillRegisterData();
    billRegisterData.cmd = ConstValue.CMD_BILL_REGISTER;
    billRegisterData.userid = userId;
    billRegisterData.cardNo = cardNo;
    billRegisterData.expMonth = expMonth;
    billRegisterData.expYear = expYear;
    billRegisterData.buyerAuthNo = buyerAuthNo;
    billRegisterData.cardPw = cardPw;
    billRegisterData.buyerPhone = buyerPhone;
    billRegisterData.buyerName = buyerName;

    OApiSv.billRegister(billRegisterData).then(response => {
      showAlert('결과', decodeURIComponent(response.data));
      const jsonData = queryStringToJSON(response.data);
      if (jsonData.state === ConstValue.SUCCESS) {
        const newBill = new BillDataDAO();
        newBill.userid = userId;
        newBill.buyerName = buyerName;
        newBill.recvphone = buyerPhone;
        const billResponseData = new BillResponseData();
        billResponseData.encBill = jsonData.encBill;
        billResponseData.billAuthNo = jsonData.billAuthNo;
        billResponseData.cardNo = jsonData.cardno;
        billResponseData.cardName = jsonData.cardname;
        newBill.billResponseData = billResponseData;
        /**
         * 등록된 Bill데이터 DB 저장 
         */
        setBillDataArray([...billDataArray, newBill])
      }
    });
  }

  /**
   * Bill결제 삭제
   * @param billData 
   */
  const billDelete = (billData: BillDataDAO) => {
    const billDeleteData = new BillDeleteData();
    billDeleteData.cmd = ConstValue.CMD_BILL_DELETE;
    billDeleteData.userid = userId;
    billDeleteData.encBill = billData.billResponseData!.encBill;

    OApiSv.billDelete(billDeleteData).then(response => {
      showAlert('결과', decodeURIComponent(response.data));
      const jsonData = queryStringToJSON(response.data);
      if (jsonData.state === ConstValue.SUCCESS) {
        let datas = billDataArray;
        const res = datas.filter(obj => obj.billResponseData!.encBill !== billData.billResponseData!.encBill);
        setBillDataArray(res)
      }
    });
  }

  /**
   * Bill 결제 요청 
   * @param billData 
   */
  const billPayment = (billData: BillDataDAO) => {
    const billReqData = new BillPaymentData();
    billReqData.cmd = ConstValue.CMD_BILL_PAYMENT;
    billReqData.userid = userId;
    billReqData.encBill = billData.billResponseData!.encBill;
    billReqData.goodname = 'BILL 테스트 상품';
    billReqData.price = '1000';
    billReqData.recvphone = billData.recvphone;

    OApiSv.billPayment(billReqData).then(response => {
      showAlert('결과', decodeURIComponent(response.data));
      const jsonData = queryStringToJSON(response.data);
      if (jsonData.state === ConstValue.SUCCESS) {
      }
    });
  }


  function queryStringToJSON(queryString) {

    let pairs = decodeURIComponent(queryString).substring(0).split('&');
    var array = pairs.map((el) => {
      const parts = el.split('=');
      return parts;
    });
    return Object.fromEntries(array);
  }

  return (
    <OApiContext.Provider
      value={{
        userId,
        resetModal,
        setUserID,
        linkKey,
        setLinkKey,
        recvphone,
        setRecvPhone,
        email,
        setEmail,
        rebillExpire,
        setRebillExpire,
        billDataArray,
        setBillDataArray,
        cardNo,
        setCardNo,
        cardPw,
        setCardPw,
        expMonth,
        setExpMonth,
        expYear,
        setExpYear,
        buyerAuthNo,
        setBuyerAuthNo,
        buyerPhone,
        setBuyerPhone,
        buyerName,
        setBuyerName,
        mul_no,
        setMulNo,
        rebill_no,
        setRebillNo,
        cashstno,
        setCashstNo,
        reset,
        visibleRegisterModal,
        setVisibleRegisterModal,
        visibleListModal,
        setVisibleListModal,

        payReqeust,
        payCancel,
        payCancelReq,
        rebillRegist,
        rebillCancel,
        rebillStop,
        rebillStart,
        sellerRegist,
        useridCheck,
        subidRegist,
        cashStRegist,
        cashStCancel,
        checkNpayCashReceiptReq,
        billRegister,
        billDelete,
        billPayment
      }}>
      {children}
    </OApiContext.Provider>
  );
};

export { OApiContextProvider, OApiContext };
