<?php
//-------------------- 웹노티(feedbackurl) --------------------//

/*************************************************************************/
/* payapp                                                                */
/* copyright ⓒ 2012 UDID. all rights reserved.                           */
/*                                                                       */
/* oapi sample                                                           */
/* - payapp 서버로부터 결제요청상태 정보를 전달받아 처리합니다.          */
/*                                                                       */
/*************************************************************************/

/*
결제요청시 feedbackurl로 작성하는 페이지 입니다.
결제완료 또는 취소가 되면 feedbackurl을 payapp.kr에서 호출합니다.
feedbackurl 페이지는 외부로 노출되지 않도록 주의 해야 합니다. 외부로 노출되면 결제를 변조하는 시도를 할 수 있습니다.

이 페이지는 payapp 서버에서 호출을 하는 페이지 입니다. 따라서 사용자는 이페이지를 볼 수 없습니다.
본페이지는 payapp.kr에서 접속이 가능해야 합니다.

payapp.kr에서 데이터는 POST로 전송을 합니다.

feedbackurl은 여러번 호출이 될 수 있습니다. 각 상태별 중복처리 되지 않도록 하셔야 합니다.
결제요청시 checkretry이 'y'인 경우 응답으로 'SUCCESS'가 아니면 재요청합니다.

이 페이지에서 페이지 이동을 하시면 정상적인 동작이 되지 않습니다.
(javascript, http code 302 등을 사용한 페이지 이동 포함)

*/

/*
$_POST['userid'];    판매자 회원 아이디
$_POST['linkkey'];   연동 KEY
$_POST['linkval'];   연동 VALUE
$_POST['goodname'];  상품명
$_POST['price'];     결제요청 금액
$_POST['recvphone']; 수신 휴대폰번호
$_POST['memo'];      메모
$_POST['reqaddr'];   주소요청 (1:요청, 0:요청안함)
$_POST['reqdate'];   결제요청 일시
$_POST['pay_memo'];  결제시 입력한 메모
$_POST['pay_addr'];  결제시 입력한 주소
$_POST['pay_date'];  결제승인 일시
$_POST['pay_type'];  결제수단 (1:신용카드, 2:휴대전화, 4:대면결제, 6:계좌이체, 7:가상계좌, 15:카카오페이, 16:네이버페이, 17:등록결제, 21: 스마일페이, 22:위챗페이, 23:애플페이, 24:내통장결제)
$_POST['pay_state']; 결제요청 상태 (4:결제완료, 8,16,31:요청취소, 9,64:승인취소, 10:결제대기)
$_POST['var1'];      임의 사용 변수 1
$_POST['var2'];      임의 사용 변수 2
$_POST['mul_no'];    결제요청번호
$_POST['payurl'];    결제페이지 주소
$_POST['csturl'];    매출전표URL
$_POST['card_name']; 신용카드명
$_POST['vccode'];    국제전화 국가번호
$_POST['vbank'];     은행명 (가상계좌 결제일 경우)
$_POST['vbankno'];   입금계좌번호 (가상계좌 결제일 경우)
$_POST['feedbacktype'];    feedback 구분 (0:API, 1:공통통보URL)
*/

// 아래 정보를 payapp 판매자의 정보로 입력하세요.
// 판매자 사이트에 있는 연동KEY, 연동VALUE는 일반 사용자에게 노출이 되지 않도록 주의 하시기 바랍니다.
$payapp_userid  = 'payapp 판매자 아이디';  // payapp 판매자 아이디
$payapp_linkkey = '연동KEY';              // payapp 연동key, 판매자 사이트 로그인 후 설정 메뉴에서 확인 가능
$payapp_linkval = '연동VALUE';            // payapp 연동value, 판매자 사이트 로그인 후 설정 메뉴에서 확인 가능
$order_price    = '1000';                // 결제요청한 금액

$check_userid = $_POST['userid'] == $payapp_userid;
$check_key    = $_POST['linkkey'] == $payapp_linkkey;
$check_val    = $_POST['linkval'] == $payapp_linkval;
$check_price  = $_POST['price'] == $order_price;

/*
userid, linkkey, linkval 값을 비교 확인 하고 동일한 경우에만 결제여부를 처리 하셔야 합니다.
*/
if ($check_userid && $check_key && $check_val && $check_price) {
    switch ($_POST['pay_state']) {
        case '1':
            // 결제요청
            break;
        case '4':
            // 결제완료
            // 결제요청한 결제건이 결제가 완료된 상태입니다.
            // 이곳에서 결제완료에 대한 처리 (상품배송/서비스 제공 등)를 하시면 됩니다.

            /*
            TODO : 이곳에서 결제완료 처리를 합니다.

            ex) UPDATE payrequest SET pay_state='결제완료', pay_date='{$_POST['pay_date']}' WHERE orderno='$_POST['var1']' AND mul_no={$_POST['mul_no']};
            */
            break;
        case '8':
        case '32':
            // 요청취소

            /*
            TODO : 이곳에서 결제요청 취소 처리를 합니다. (결제하지 않은 상태에서 취소)
            */
            break;
        case '9':
        case '64':
            // 승인취소

            /*
            TODO : 이곳에서 결제승인 취소 처리를 합니다. (결제완료 상태에서 취소)

            ex) UPDATE payrequest SET pay_state='결제취소', canceldate='{$_POST['canceldate']}' WHERE orderno='$_POST['var1']' AND mul_no={$_POST['mul_no']};
            */
            break;
        case '10':
            // 결제대기
            break;
        case '70':
        case '71':
            // 부분취소

            /*
            TODO : 이곳에서 결제승인 부분취소 처리를 합니다. (결제완료 상태에서 부분취소)

            ex) UPDATE payrequest SET pay_state='결제취소', canceldate='{$_POST['canceldate']}', cancelprice='{$_POST['price']}' WHERE orderno='$_POST['var1']' AND mul_no={$_POST['mul_no']};
            */
            break;
        default:
            break;
    }
}


// 처리응답
// 결제요청시 checkretry이 'y'인 경우 응답이 'SUCCESS'가 아니면 재호출 합니다. (총 10회)
echo 'SUCCESS';
// 처리실패
//echo 'FAIL';

exit;

?>