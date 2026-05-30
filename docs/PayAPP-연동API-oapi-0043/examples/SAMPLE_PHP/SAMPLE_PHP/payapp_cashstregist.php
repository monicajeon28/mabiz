<?php
//-------------------- 현금영수증 발행 --------------------//

/*************************************************************************/
/* payapp                                                                */
/* copyright ⓒ 2012 UDID. all rights reserved.                           */
/*                                                                       */
/* oapi sample                                                           */
/* - payapp 현금영수증 발행 연동.                                             */
/*                                                                       */
/*************************************************************************/

/*
현금영수증을 발행하는 연동입니다.
*/
include("payapp_lib.php");

// 아래 입력정보를 알맞게 수정하세요.
$postdata = array(
    'cmd'           => 'cashStRegist',   // 현금영수증발행, 필수
    'userid'        => '',               // 판매자 아이디, 필수
    'linkkey'       => '',               // 판매자 연동KEY, 필수
    'good_name'     => '',               // 상품명, 필수
    'buyr_name'     => '',               // 구매자명, 필수
    'buyr_tel1'     => '',               // 구매자 휴대폰
    'buyr_mail'     => '',               // 구매자 이메일
    'id_info'       => '',               // 휴대폰번호 또는 사업자번호, 필수
    'trad_time'     => '',               // 원거래시각(예:년월일시분초), 필수
    'tr_code'       => '',               // 발행용도(0=소득공제용, 1=지출증빙용), 필수
    'amt_tot'       => '',               // 거래금액, 필수
    'amt_sup'       => '',               // 공급가액, 필수
    'amt_svc'       => '',               // 봉사료, 필수
    'amt_tax'       => '',               // 부가가치세, 필수
    'corp_tax_type' => '',               // TG01=과세, TG02=면세, 필수

);

$oResData = payapp_oapi_post($postdata);
if ($oResData['state'] == '1') {
    // 발행성공
    /*
    $oResData['cashstno'];	// 발행번호
    $oResData['cashsturl'];	// 발행url
    */
} else {
    // 발행실패
    // 실패메시지($oResData['errorMessage'])를 확인하고, 수정하고 재시도 하셔야 합니다.
    /*
    $oResData['errorMessage'];	// 오류메시지
    */
}


?>