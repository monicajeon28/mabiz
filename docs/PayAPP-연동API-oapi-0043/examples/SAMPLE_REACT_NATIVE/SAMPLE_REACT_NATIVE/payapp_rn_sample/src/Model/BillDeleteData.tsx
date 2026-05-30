export class BillDeleteData {
    /**
     * cmd
     * 필수
     */
    cmd?: String;

    /**
     * 판매자 회원 아이디
     * 필수
     */
    userid?: String;

    /**
     * 결제회원 연동키
     * 필수
     */
    encBill?: String;
}
