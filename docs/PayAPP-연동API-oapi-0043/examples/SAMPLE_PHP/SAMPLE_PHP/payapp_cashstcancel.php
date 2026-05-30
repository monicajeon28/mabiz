<?php
//-------------------- 현금영수증 취소 --------------------//

/*************************************************************************/
/* payapp                                                                */
/* copyright ⓒ 2012 UDID. all rights reserved.                           */
/*                                                                       */
/* oapi sample                                                           */
/* - payapp 현금영수증 발행 취소 연동.                                   */
/*                                                                       */
/*************************************************************************/

/*
현금영수증을 발행 취소하는 연동입니다.
*/
include("payapp_lib.php");

// 아래 입력정보를 알맞게 수정하세요.
$postdata = array(
    'cmd'      => 'cashStCancel',   // 현금영수증취소, 필수
    'userid'   => '',               // 판매자 아이디, 필수
    'linkkey'  => '',               // 판매자 연동KEY, 필수
    'cashstno' => '',               // 발행번호, 필수
);

$oResData = payapp_oapi_post($postdata);
if ($oResData['state'] == '1') {
    // 취소성공
} else {
    // 취소실패
    // 실패메시지($oResData['errorMessage'])를 확인하고, 수정하고 재시도 하셔야 합니다.
    /*
    $oResData['errorMessage'];	// 오류메시지
    */
}


?>