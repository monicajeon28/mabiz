//
//  PACashStRegistData.swift
//  Payapp_iOS_Sample_V2
//
//  Created by Jin Won Kim on 2021/11/01.
//

import ObjectMapper

class PACashStRegistData: Mappable {

    /**
    * cmd
    * 필수
    */
    var cmd:String?
    
    /**
     * 판매자 회원 아이디
     * 필수
     */
    var userid:String?

    /**
     * 연동 KEY
     * 필수
     */
    var linkkey:String? 

    /**
     * 상품명
     * 필수
     */
    var good_name:String?

    /**
     * 구매자명
     * 필수
     */
    var buyr_name:String?

    /**
     * 휴대폰번호 또는 사업자번호
     * 필수
     */
    var id_info:String?

    /**
     * 원거래시각
     * 필수
     */
    var trad_time:String?

    /**
     * 발행용도(0:소득공제용, 1:지출증빙용)
     * 필수
     */
    var tr_code:String?

    /**
     * 거래금액
     * 필수
     */
    var amt_tot:String?

    /**
     * 공급가액
     * 필수
     */
    var amt_sup:String?

    /**
     * 봉사료
     * 필수
     */
    var amt_svc:String?

    /**
     * 부가가치세
     * 필수
     */
    var amt_tax:String?

    /**
     * 과세:TG01, 면세:TG02
     * 필수
     */
    var corp_tax_type:String?

    /**
     * 구매자 휴대폰
     */
    var buyr_tel1:String?

    /**
     * 구매자 이메일
     */
    var buyr_mail:String?
    
    required init?(map: Map){}
    init(userid: String, linkkey: String, good_name: String, buyr_name: String, id_info: String, trad_time: String, tr_code: String, amt_tot: String, amt_sup: String, amt_svc: String, amt_tax: String, corp_tax_type: String){

        self.userid = userid
        self.linkkey = linkkey
        self.good_name = good_name
        self.buyr_name = buyr_name
        self.id_info = id_info
        self.trad_time = trad_time
        self.tr_code = tr_code
        self.amt_tot = amt_tot
        self.amt_sup = amt_sup
        self.amt_svc = amt_svc
        self.amt_tax = amt_tax
        self.corp_tax_type = corp_tax_type
    }
    
    func mapping(map: Map) {
        
        cmd                             <- map["cmd"]
        userid                          <- map["userid"]
        linkkey                         <- map["linkkey"]
        good_name                       <- map["good_name"]
        buyr_name                       <- map["buyr_name"]
        id_info                         <- map["id_info"]
        trad_time                       <- map["trad_time"]
        tr_code                         <- map["tr_code"]
        amt_tot                         <- map["amt_tot"]
        amt_sup                         <- map["amt_sup"]
        amt_svc                         <- map["amt_svc"]
        amt_tax                         <- map["amt_tax"]
        corp_tax_type                   <- map["corp_tax_type"]
        buyr_tel1                       <- map["buyr_tel1"]
        buyr_mail                       <- map["buyr_mail"]

    }
}
