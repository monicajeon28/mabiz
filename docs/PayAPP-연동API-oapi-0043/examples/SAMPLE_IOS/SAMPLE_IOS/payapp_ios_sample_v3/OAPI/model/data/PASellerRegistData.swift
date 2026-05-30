//
//  PASellerRegistData.swift
//  Payapp_iOS_Sample_V2
//
//  Created by Jin Won Kim on 2021/11/01.
//

import ObjectMapper

class PASellerRegistData: Mappable {

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
     * 판매자 회원 비밀번호 (영문,숫자 8자리)
     * 필수
     */
    var userpwd:String?

    /**
     * 판매자명
     * 필수
     */
    var sellername:String?

    /**
     * 판매자 휴대전화번호
     * 필수
     */
    var phone:String?

    /**
     * 이메일
     * 필수
     */
    var email:String?

    /**
     * 서비스 구분
     * 필수
     */
    var bizkind:String?

    /**
     * 판매자 구분 (개인:1, 사업자:2)
     * 필수
     */
    var usertype:String?

    /**
     * 대리점 또는 리셀러 아이디
     * 필수
     */
    var resellerid:String?

    /**
     * 가입형태 (유료:0, 할인:4), 리셀러 회원 가입은 유료형
     * 필수
     */
    var join_type:String?

    /**
     * 가입구분 (seller,reseller)
     * 필수
     */
    var seller_type:String?

    /**
     * (사업자 필수) 사업자등록번호
     */
    var compregno:String?

    /**
     * (사업자 필수) 상호명(법인명)
     */
    var compname:String?

    /**
     * (사업자 필수) 업태
     */
    var biztype1:String?

    /**
     * (사업자 필수) 업종
     */
    var biztype2:String?

    /**
     * 주소-우편번호
     */
    var zipcode:String?

    /**
     * 주소1
     */
    var addr1:String?

    /**
     * 주소2
     */
    var addr2:String?

    /**
     * 홈페이지
     */
    var homepage:String?

    /**
     * 정산은행
     */
    var compbank:String?

    /**
     * 정산은행 계좌번호
     */
    var compbanknum:String?

    /**
     * 정산은행 예금주
     */
    var compbankname:String?

    /**
     * (개인 필수) 이름
     */
    var username:String?


    /**
     * (사업자 필수) 대표자 성함
     */
    var ceo_nm:String?

    /**
     * 공통 통보 URL
     */
    var common_feedbackurl:String?

    /**
     * 사업자 구분 (1:법인,2:개인)
     */
    var corp_type:String?
    
    required init?(map: Map){}
    init(userid:String, userpwd:String, sellername:String, phone:String, email:String, bizkind:String, usertype:String, resellerid:String, join_type:String, seller_type:String){
        
        
        self.userid = userid
        self.userpwd = userpwd
        self.sellername = sellername
        self.phone = phone
        self.email = email
        self.bizkind = bizkind
        self.usertype = usertype
        self.resellerid = resellerid
        self.join_type = join_type
        self.seller_type = seller_type
    }
    
    func mapping(map: Map) {
        
        cmd                             <- map["cmd"]
        userid                          <- map["userid"]
        userpwd                         <- map["userpwd"]
        sellername                      <- map["sellername"]
        phone                           <- map["phone"]
        email                           <- map["email"]
        bizkind                         <- map["bizkind"]
        usertype                        <- map["usertype"]
        resellerid                      <- map["resellerid"]
        join_type                       <- map["join_type"]
        seller_type                     <- map["seller_type"]
        compregno                       <- map["compregno"]
        compname                        <- map["compname"]
        biztype1                        <- map["biztype1"]
        zipcode                         <- map["zipcode"]
        addr1                           <- map["addr1"]
        addr2                           <- map["addr2"]
        homepage                        <- map["homepage"]
        compbank                        <- map["compbank"]
        compbanknum                     <- map["compbanknum"]
        compbankname                    <- map["compbankname"]
        username                        <- map["username"]
        ceo_nm                          <- map["ceo_nm"]
        common_feedbackurl              <- map["common_feedbackurl"]
        corp_type                       <- map["corp_type"]

    }
}
