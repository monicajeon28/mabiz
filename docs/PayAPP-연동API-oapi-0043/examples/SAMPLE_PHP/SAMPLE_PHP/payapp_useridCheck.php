<?php
//-------------------- 아이디 체크 --------------------//

/*************************************************************************/
/* payapp                                                                */
/* copyright ⓒ 2012 UDID. all rights reserved.                           */
/*                                                                       */
/* oapi sample                                                           */
/* - payapp 아이디 중복체크 연동.                                        */
/*                                                                       */
/*************************************************************************/

/*
페이앱 대리점,리셀러가
리셀러 또는 판매자를 가입시키고자 할때 페이앱 아이디 중복체크 하는 연동입니다.
*/
include("payapp_lib.php");

// 아래 입력정보를 알맞게 수정하세요.
$postdata = array(
    'cmd'        => 'useridCheck',            // 아이디 중복체크, 필수
    'userid'     => 'payapp 판매자 아이디',            // 판매자 아이디, 필수
    'resellerid'    => 'payapp 대리점 또는 리셀러 아이디',            // payapp 대리점 또는 리셀러 아이디, 필수
);

$oResData = payapp_oapi_post($postdata);
if ($oResData['state'] == '1') {
    // 중목안됨
    // userid의 값이 중복되지 않습니다. 해당 아이디로 가입이 가능합니다.
} else {
    // 연동실패 또는 아이디 중복
    // 실패메시지($oResData['errorMessage'])를 확인하고, 수정 또는 다른 아이디로 재시도 하셔야 합니다.
    /*
    $oResData['errorMessage'];	// 오류메시지
    */
}


?>