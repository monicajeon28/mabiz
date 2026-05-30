<?php
//-------------------- 네이버페이 현금영수증 발행대상 금액 조회 --------------------//

/*************************************************************************/
/* payapp                                                                */
/* copyright ⓒ 2020 UDID. all rights reserved.                           */
/*                                                                       */
/* oapi sample                                                           */
/* - payapp 네이버페이 현금영수증 발행대상 금액조회                              */
/*                                                                       */
/*************************************************************************/

/*
네이버페이 현금영수증 발행대상 금액 조회하는 연동입니다.
*/
include("payapp_lib.php");

// 아래 입력정보를 알맞게 수정하세요.
$postdata = array(
    'cmd'           => 'getNaverpayCashPrice',         // 네이버페이 현금영수증 금액 조회, 필수
    'userid'        => '',               // 판매자 아이디, 필수
    'linkkey'       => '',               // 판매자 연동KEY, 필수
    'mul_no'        => '',               // 결제요청번호, 필수

);

$oResData = payapp_oapi_post($postdata);
if ($oResData['state'] == '1') {
    // 조회성공
    /*
    $oResData['totalCashAmount'];	// 현금영수증 발행 대상 총 금액
    $oResData['supplyCashAmount'];	// 현금성 총 공급가
    $oResData['vatCashAmount'];	    // 현금성 총 부가세
    */
} else {
    // 조회실패
    // 실패메시지($oResData['errorMessage'])를 확인하고, 수정하고 재시도 하셔야 합니다.
    /*
    $oResData['errorMessage'];	// 오류메시지
    */
}


?>