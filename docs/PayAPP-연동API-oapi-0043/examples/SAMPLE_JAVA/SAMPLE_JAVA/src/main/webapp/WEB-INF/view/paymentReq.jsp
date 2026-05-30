<%--
  Created by IntelliJ IDEA.
  User: kimjinwon
  Date: 2016. 11. 10.
  Time: 오후 4:26
  To change this template use File | Settings | File Templates.
--%>

<%@ page contentType="text/html;charset=UTF-8" language="java" %>

<jsp:include page="/WEB-INF/view/common/header.jsp"/>

<html>
<head>

    <title>결제 요청 </title>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
</head>

<body>

<div class="container">

    <div class="page-header">
        <h1>Payapp 결제 요청 샘플
            <small>for java</small>
        </h1>
    </div>

    <form class="form-horizontal" role="form" method='post' action="paymentReqAction">

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
            <label for="goodname" class="col-sm-2 control-label">상품명</label>

            <div class="col-sm-10">
                <input type="text" class="form-control" id="goodname" name="goodname" placeholder="상품명"
                       required="required">
            </div>
        </div>
        <div class="form-group">
            <label for="price" class="col-sm-2 control-label">상품 가격</label>

            <div class="col-sm-10">
                <input type="number" class="form-control" id="price" name="price" placeholder="상품 가격"
                       required="required">
            </div>
        </div>
        <div class="form-group">
            <label for="recvphone" class="col-sm-2 control-label">고객 연락처</label>

            <div class="col-sm-10">
                <input type="tel" class="form-control" name="recvphone" id="recvphone" placeholder="고객 연락처"
                       required="required">
            </div>
        </div>
        <div class="form-group">
            <label for="memo" class="col-sm-2 control-label">메모</label>

            <div class="col-sm-10">
                <textarea class="form-control" name="memo" id="memo" rows="3" placeholder="메모"></textarea>
            </div>
        </div>
        <div class="form-group">
            <div class="col-sm-offset-2 col-sm-10">
                <button type="submit" class="btn btn-primary">결제 요청</button>
            </div>
        </div>
    </form>
</div>
</body>
</html>


