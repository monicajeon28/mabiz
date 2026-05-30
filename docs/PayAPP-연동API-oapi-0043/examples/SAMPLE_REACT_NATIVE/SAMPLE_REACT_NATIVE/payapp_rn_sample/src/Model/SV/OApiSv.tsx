import * as NetworkManager from '~/Model/SV/NetworkManager';



import {CashStCancelData} from '~/Model/CashStCancelData';
import {CashStRegistData} from '~/Model/CashStRegistData';
import {CheckNpayCashReceiptReqData} from '~/Model/CheckNpayCashReceiptReqData';
import {PayRequestData} from '~/Model/PayRequestData';
import {RebillCancelData} from '~/Model/RebillCancelData';
import {PayCancelReqData} from '~/Model/PayCancelReqData';
import {RebillRegistData} from '~/Model/RebillRegistData';
import {RebillStartData} from '~/Model/RebillStartData';
import {RebillStopData} from '~/Model/RebillStopData';
import {SellerRegistData} from '~/Model/SellerRegistData';
import {SubidRegistData} from '~/Model/SubidRegistData';
import {UseridCheckData} from '~/Model/UseridCheckData'; 
import {BillRegisterData} from '~/Model/BillRegisterData'; 
import {BillDeleteData} from '~/Model/BillDeleteData'; 
import {BillPaymentData} from '~/Model/BillPaymentData'; 

/**
 * 결제 요청
 *
 * 호출 파라메터 중 userid,goodname,price,recvphone 값은 필수 입니다.
 * feedbackurl 의 값은 “http://” 가 포함된 url 주소 값입니다.
 * 구매자가 결제완료시 feedbackurl로 아래 “feedbackurl 전달” 파라메터가 POST방식으로 전달 됩니다.
 * var1, var2 의 값은 임의로 사용이 가능하며 결제 완료시 feedbackurl 로 그대로 전달이 됩니다.
 * 결제요청 구분 (reqmode)가 usd (달러결제) 인 경우 openpaytype은 무시됩니다. (신용카드 결제만 가능)
 * 결제완료에 대한 처리는 feedbackurl에서 처리 하셔야 합니다.
 */
export const payReqeust = (params: PayRequestData) => {
  return NetworkManager.request('POST', params);
};

/**
 * 결제(요청,승인)취소
 *
 * 호출 파라메터 중 userid, linkkey, mul_no 값은 필수 입니다.
 * “2.1. 결제 요청” 연동 에서 feedbackurl을 입력된 결제요청 건 경우에는 결제 요청 취소 성공시 “2.1.6 Feedbackurl 전달” 으로 자료가 전송됩니다.
 * 부분 승인취소인 경우 “2.4 FeedbackURL”로 전달되는 mul_no(결제요청번호)는 변경 됩니다
 */
export const payCancel = (params: PayRequestData) => {
  return NetworkManager.request('POST', params);
};

/**
 * 결제요청취소
 *
 * 구매자가 결제승인 후 D+5일이 경과 되었거나, 판매자 정산이 완료된 경우 “2.3. 결제(요청,승인) 취소” 연동으로 취소 되지 않습니다.
 * 이 경우 결제 취소 요청 연동 후 정산금액을 반환하셔야(판매자 정산이 완료된 경우) 취소가 가능합니다.
 */
export const payCancelReq = (params: PayCancelReqData) => {
  return NetworkManager.request('POST', params);
};

/**
 * 정기 결제 요청
 *
 * 정기 결제를 위한 정기 결제 요청을 등록하는 API입니다.
 * 정기 결제 요청 등록 후 payurl로 구매자가 최초 1회 결제 승인이 성공하면 다음 결제 주기에 정기 결제가 발생됩니다.
 * 휴대전화 정기 결제는 월 정기 결제만 이용이 가능합니다.
 */
export const rebillRegist = (params: RebillRegistData) => {
  return NetworkManager.request('POST', params);
};

/**
 * 정기 결제 해지
 *
 * 해지된 정기 결제 건은 복구가 불가능 합니다.
 */
export const rebillCancel = (params: RebillCancelData) => {
  return NetworkManager.request('POST', params);
};

/**
 * 정기 결제 일시정지
 *
 * 정기 결제 요청 건의 상태가 “승인”인 경우 일시정지가 가능합니다.
 * 일시정지된 정기 결제 건은 다음 결제 주기에 정기 결제가 발생되지 않습니다.
 * 일시정지된 정기 결제 건은 “승인” 상태로 변경이 가능합니다.
 */
export const rebillStop = (params: RebillStopData) => {
  return NetworkManager.request('POST', params);
};

/**
 * 정기 결제 승인
 *
 * 정기 결제 요청 건의 상태가 “일시정지”인 경우 승인 상태로 변경이 가능합니다.
 * 승인 상태인 정기 결제 건은 다음 결제 주기에 정기 결제가 발생합니다.
 */
export const rebillStart = (params: RebillStartData) => {
  return NetworkManager.request('POST', params);
};

/**
 * 판매자 회원 가입
 *
 * 대리점이 리셀러를, 리셀러가 판매자를 가입하는 연동입니다.
 * resellerid는 대리점 또는 리셀러 아이디를 입력하셔야 합니다.
 */
export const sellerRegist = (params: SellerRegistData) => {
  return NetworkManager.request('POST', params);
};

/**
 * 판매자 회원 아이디 중복 체크
 *
 * resellerid는 대리점 또는 리셀러 아이디를 입력하셔야 합니다.
 */
export const useridCheck = (params: UseridCheckData) => {
  return NetworkManager.request('POST', params);
};

/**
 * 부계정 등록
 *
 * 직원별로 카드 결제 및 매출 현황관리를 가능하도록 부계정을 등록하는 연동입니다.
 */
export const subidRegist = (params: SubidRegistData) => {
  return NetworkManager.request('POST', params);
};

/**
 * 현금영수증 발행
 *
 * 현금영수증 발행 연동입니다.
 */
export const cashStRegist = (params: CashStRegistData) => {
  return NetworkManager.request('POST', params);
};

/**
 * 현금영수증 발행 취소
 *
 * 현금영수증 발행 취소 연동입니다.
 */
export const cashStCancel = (params: CashStCancelData) => {
  return NetworkManager.request('POST', params);
};

/**
 * 네이버페이 현금영수증 발행대상 금액조회
 *
 * 네이버페이 현금영수증 발행대상 금액조회입니다.
 */
export const checkNpayCashReceiptReq = (
  params: CheckNpayCashReceiptReqData,
) => {
  return NetworkManager.request('POST', params);
};

/**
 * 결제회원(BILL) 등록
 *
 * ...
 */
export const billRegister = (
  params: BillRegisterData,
) => {
  return NetworkManager.request('POST', params);
};

/**
 * 결제회원(BILL) 삭제
 *
 * ...
 */
export const billDelete = (
  params: BillDeleteData,
) => {
  return NetworkManager.request('POST', params);
};

/**
 * 결제회원(BILL) 결제
 *
 * ...
 */
export const billPayment = (
  params: BillPaymentData,
) => {
  return NetworkManager.request('POST', params);
};