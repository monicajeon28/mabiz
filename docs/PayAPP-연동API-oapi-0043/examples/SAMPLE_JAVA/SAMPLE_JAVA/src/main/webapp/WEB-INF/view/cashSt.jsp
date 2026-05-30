<%--
  Created by IntelliJ IDEA.
  User: kimjinwon
  Date: 2016. 11. 14.
  Time: 오후 1:27
  To change this template use File | Settings | File Templates.
--%>

<%@ page contentType="text/html;charset=UTF-8" language="java" %>

<jsp:include page="/WEB-INF/view/common/header.jsp"/>

<html>
<head>
    <title>현금영수증 발행 </title>

    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://gitcdn.github.io/bootstrap-toggle/2.2.2/css/bootstrap-toggle.min.css" rel="stylesheet">
    <script src="https://gitcdn.github.io/bootstrap-toggle/2.2.2/js/bootstrap-toggle.min.js"></script>


</head>
<body>

<div class="container">

    <div class="page-header">
        <h1>Payapp 현금영수증 발행 샘플
            <small>for java</small>
        </h1>

    </div>

    <form class="form-horizontal" role="form" method='post' action="cashStAction">

        <c:choose>
        <div class="form-group">
            <c:when test="${not empty errorMsg}">
                <label class="error">${errorMsg}</label>
            </c:when>
            <c:when test="${not empty result}">
                <label class="error">${result}</label>
            </c:when>
        </div>
        </c:choose>

        <div class="form-group">
            <label for="userid" class="col-sm-2 control-label">판매자 아이디</label>

            <div class="col-sm-10">
                <input type="text" class="form-control" id="userid" name="userid" placeholder="판매자 아이디"
                       required="required">
            </div>
        </div>
        <hr>

        <div class="form-group">
            <label for="good_name" class="col-sm-2 control-label">상품명</label>

            <div class="col-sm-10">
                <input type="text" class="form-control" id="good_name" name="good_name" placeholder="상품명"
                       required="required">
            </div>
        </div>
        <div class="form-group">
            <label for="buyr_name" class="col-sm-2 control-label">구매자명</label>

            <div class="col-sm-10">
                <input type="text" class="form-control" id="buyr_name" name="buyr_name" placeholder="구매자명"
                       required="required">
            </div>
        </div>

        <div class="form-group">
            <label for="id_info" class="col-sm-2 control-label">휴대폰번호 또는 사업자번호</label>

            <div class="col-sm-10">
                <input type="number" class="form-control" id="id_info" name="id_info" placeholder="휴대폰번호 또는 사업자번호"
                       required="required">
            </div>
        </div>

        <div class="form-group">
            <label for="trad_time" class="col-sm-2 control-label">원거래시각</label>

            <div class="col-sm-10">
                <input type="number" class="form-control" id="trad_time" name="trad_time" placeholder="ex) 20160916123456"
                       required="required">
            </div>
        </div>
        <div class="form-group">
            <label for="tr_code" class="col-sm-2 control-label">발행용도 </label>

            <div class="col-sm-10">
                <input type="checkbox" id="tr_code" name="tr_code" data-toggle="toggle" data-on="소득공제용" data-off="지출증빙용"
                       checked>
            </div>
        </div>

        <div class="form-group">
            <label for="amt_tot" class="col-sm-2 control-label">거래금액</label>

            <div class="col-sm-10">
                <input type="number" class="form-control" id="amt_tot" name="amt_tot" placeholder="거래금액"
                       required="required">
            </div>
        </div>
        <div class="form-group">
            <label for="amt_sup" class="col-sm-2 control-label">공급가액</label>

            <div class="col-sm-10">
                <input type="number" class="form-control" id="amt_sup" name="amt_sup" placeholder="공급가액"
                       required="required">
            </div>
        </div>
        <div class="form-group">
            <label for="amt_svc" class="col-sm-2 control-label">봉사료</label>

            <div class="col-sm-10">
                <input type="number" class="form-control" id="amt_svc" name="amt_svc" placeholder="봉사료"
                       required="required">
            </div>
        </div>
        <div class="form-group">
            <label for="amt_tax" class="col-sm-2 control-label">부가가치세</label>

            <div class="col-sm-10">
                <input type="number" class="form-control" id="amt_tax" name="amt_tax" placeholder="부가가치세"
                       required="required">
            </div>
        </div>

        <div class="form-group">
            <label for="corp_tax_type" class="col-sm-2 control-label">과세 or 면세</label>

            <div class="col-sm-10">
                <input type="checkbox" id="corp_tax_type" name="corp_tax_type" data-toggle="toggle" data-on="과세"
                       data-off="TG02" checked>
            </div>
        </div>


        <div class="col-sm-offset-2 col-sm-10">
            <button type="submit" class="btn btn-primary">현금영수증 발행</button>
        </div>
</div>
</form>
</div>
</body>
</html>