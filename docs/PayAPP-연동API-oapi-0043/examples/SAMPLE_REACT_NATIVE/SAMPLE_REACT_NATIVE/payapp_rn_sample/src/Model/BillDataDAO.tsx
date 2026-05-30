import { BillResponseData } from '~/Model/BillResponseData';

export class BillDataDAO {     

    /**
     * 판매자 회원 아이디
     */
    userid?:String;

    /**
     * 구매자 성함
     */
    buyerName?:String;

    /**
     * 구매자 전화번호
     */
    recvphone?:String;
   
    /**
     * Bill 정보 
     */
     billResponseData?: BillResponseData;
}
