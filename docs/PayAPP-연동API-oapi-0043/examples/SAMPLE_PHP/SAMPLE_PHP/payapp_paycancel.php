<?php
//-------------------- 결제요청,승인 취소 --------------------//

/*************************************************************************/
/* payapp                                                                */
/* copyright ⓒ 2012 UDID. all rights reserved.                           */
/*                                                                       */
/* oapi sample                                                           */
/* - payapp 서버로 결제요청취소 정보를 전달합니다.                           */
/*                                                                       */
/*************************************************************************/

include("payapp_lib.php");
/*
TODO : 이곳에서 결제요청 정보를 불러옵니다.

ex) SELECT mul_no FROM payrequest WHERE orderno='1234567890'
*/

// 아래 입력정보를 알맞게 수정하세요.
// 판매자 사이트에 있는 연동KEY, 연동VALUE는 일반 사용자에게 노출이 되지 않도록 주의 하시기 바랍니다.
$postdata = array(
    'cmd'        => 'paycancel',               // 결제요청 취소, 필수
    'userid'     => 'payapp 판매자 아이디',    // 판매자 아이디, 필수
    'linkkey'    => '연동KEY',                 // 연동KEY값, 필수 (판매자 사이트 로그인 후 설정 메뉴에서 확인 가능)

    // 아래 값을 고객사에 맞게 바꾸셔야 합니다.
    'mul_no'     => '1234',                    // 결제요청번호, 필수
    'cancelmemo' => '품절되었습니다',          // 결제요청취소 메모
    'cancelmode' => '',                        // 결제요청취소 모드
                                               // ready 인 경우 결제요청 상태(결제가 안된상태)인 경우 에만 취소가 됩니다.
);

$oResData = payapp_oapi_post($postdata);
if ($oResData['state'] == '1') {
    // 결제요청취소성공
    // 결제요청취소는 즉시 실행됩니다.
    // 결제요청시 feedbackurl을 사용하면 결제요청취소 성공시 feedbackurl로 취소 정보가 전달됩니다.
    // feedbackurl 을 사용하면서 이곳에서 결제요청취소를 처리하면 결제요청취소 처리가 중복될 수 있으니 주의하시기 바랍니다.

    /*
    TODO : 이곳에서 결제요청취소 성공 정보를 저장합니다. 또는 feedbackurl 에서 처리하시기 바랍니다.

    ex) UPDATE payrequest SET cancel='y',cancel_date=NOW() WHERE orderno='1234567890'
    */
} else {
    // 결제요청실패
    // 오류메시지($oResData['errorMessage'])를 확인하고, 오류를 수정하셔야 합니다.
    /*
    $oResData['errorMessage'];	// 오류메시지
    $oResData['errno'];			// 오류코드
    */

    /*
    TODO : 이곳에서 결제요청취소 실패 정보를 저장하거나, 이전 페이지로 이동해서 다시 시도할 수 있도록 해야 합니다.

    ex) UPDATE payrequest SET errorMessage='{$oResData['errorMessage']}' WHERE orderno='1234567890'
    */
}


?>
