<?php
//-------------------- 결제요청(JS) --------------------//

/*************************************************************************/
/* payapp                                                                */
/* copyright ⓒ 2012 UDID. all rights reserved.                           */
/*                                                                       */
/* oapi sample                                                           */
/* - payapp 서버로 결제요청 정보를 전달합니다.                           */
/*                                                                       */
/*************************************************************************/

/*
JS API 결제요청 샘플입니다.
결제요청은 payapp_payrequest.php (REST API), payapp_payrequest_js.php (JS API) 두개의 방식이 있습니다.

REST API를 이용할 경우
payapp_payrequest.php, payapp_feedbackurl.php 를 참고하시면 됩니다.
JS API를 이용할 경우
payapp_payrequest_js.php, payapp_feedbackurl.php 를 참고하시면 됩니다.

연동매뉴얼 (https://payapp.kr/dev_center/dev_center01.html) 참고 하시기 바랍니다.

*/
?>
<script src="//lite.payapp.kr/public/api/v2/payapp-lite.js"></script>
<script>
    PayApp.setDefault('userid',     ''); // 아이디
    PayApp.setDefault('shopname',   '상점명');
    function payappPay(){
        PayApp.setParam('goodname', '상품명');
        PayApp.setParam('price', '1000'); // 결제금액
        PayApp.setParam('recvphone', '휴대폰번호');
        PayApp.setParam('feedbackurl', '');
        PayApp.setParam('returnurl', '');
        PayApp.setParam('var1', '임의변수1');
        PayApp.setParam('var2', '임의변수2');
        PayApp.setParam('smsuse', 'n');
        PayApp.setParam('redirectpay', '1');
        PayApp.setParam('skip_cstpage', 'y');
        PayApp.payrequest();
    }
</script>
<a href="#" onclick="payappPay();">결제하기</a>
