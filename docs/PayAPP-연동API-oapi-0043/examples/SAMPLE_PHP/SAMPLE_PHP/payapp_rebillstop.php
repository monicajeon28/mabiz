<?php
//-------------------- 정기결제 일시정지 --------------------//

/*************************************************************************/
/* payapp                                                                */
/* copyright ⓒ 2012 UDID. all rights reserved.                           */
/*                                                                       */
/* oapi sample                                                           */
/* - payapp 서버로 정기결제 일시정지 정보를 전달합니다.                  */
/*                                                                       */
/*************************************************************************/

include("payapp_lib.php");
/*
TODO : 이곳에서 정기결제 요청 정보를 불러옵니다.

ex) SELECT rebill_no FROM rebillrequest WHERE orderno='1234567890'
*/

// 아래 입력정보를 알맞게 수정하세요.
// 판매자 사이트에 있는 연동KEY, 연동VALUE는 일반 사용자에게 노출이 되지 않도록 주의 하시기 바랍니다.
$postdata = array(
    'cmd'        => 'rebillStop',               // 정기결제 일시정지, 필수
    'userid'     => 'payapp 판매자 아이디',    // 판매자 아이디, 필수
    'linkkey'    => '연동KEY',                 // 연동KEY값, 필수 (판매자 사이트 로그인 후 설정 메뉴에서 확인 가능)

    // 아래 값을 고객사에 맞게 바꾸셔야 합니다.
    'rebill_no'     => '1234',                    // 정기결제 요청번호, 필수
);

$oResData = payapp_oapi_post($postdata);
if ($oResData['state'] == '1') {
    // 정기결제 일시정지 성공
    // 정기결제 일시정지는 즉시 실행됩니다.
    // 일시정지된 정기결제 요청건은 다음 정기결제 주기에 결제승인 되지 않습니다.

    /*
    TODO : 이곳에서 정기결제 해지 성공 정보를 저장합니다.

    ex) UPDATE rebillrequest SET stop='y',stop_date=NOW() WHERE orderno='1234567890'
    */
} else {
    // 정기결제 일시정지 실패
    // 오류메시지($oResData['errorMessage'])를 확인하고, 오류를 수정하셔야 합니다.
    /*
    $oResData['errorMessage'];	// 오류메시지
    $oResData['errno'];			// 오류코드
    */

    /*
    TODO : 이곳에서 정기결제 일시정지 실패 정보를 저장하거나, 이전 페이지로 이동해서 다시 시도할 수 있도록 해야 합니다.

    ex) UPDATE rebillrequest SET errorMessage='{$oResData['errorMessage']}' WHERE orderno='1234567890'
    */
}

?>
