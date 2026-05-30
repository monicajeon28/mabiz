<%--
  Created by IntelliJ IDEA.
  User: kimjinwon
  Date: 2016. 11. 10.
  Time: 오후 3:55
  To change this template use File | Settings | File Templates.
--%>
<!DOCTYPE html>
<%@ page contentType="text/html;charset=UTF-8" language="java" %>


<link rel="stylesheet" href="http://maxcdn.bootstrapcdn.com/bootstrap/3.0.0/css/bootstrap.min.css">
<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js"></script>
<script src="http://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js"></script>
<link href="/css/common.css" rel="stylesheet" type="text/css">

<nav class="navbar navbar-inverse">
    <div class="container-fluid">
        <div class="navbar-header">
            <a class="navbar-brand" href="/">페이앱 API</a>
        </div>
        <ul class="nav navbar-nav">
            <%--<li><a href="/">Home</a></li>--%>
            <li class="dropdown"><a class="dropdown-toggle" data-toggle="dropdown" href="#">결제 샘플<span
                    class="caret"></span></a>
                <ul class="dropdown-menu">
                    <li><a href="/paymentReq">결제 요청</a></li>
                    <li><a href="/paymentReqCancel">결제 취소</a></li>
                    <li><a href="/paymentCancelReq">결제 취소 요청</a></li>
                    <li><a href="/paymentRegularReq">정기 결제 요청</a></li>
                    <li><a href="/paymentCancelRegularReq">정기 결제 취소 요청</a></li>
                </ul>
            </li>

            <li class="dropdown"><a class="dropdown-toggle" data-toggle="dropdown" href="#">부계정 샘플 <span
                    class="caret"></span></a>
                <ul class="dropdown-menu">
                    <li><a href="/subidRegist">부계정 등록 </a></li>
                </ul>
            </li>

            <li class="dropdown"><a class="dropdown-toggle" data-toggle="dropdown" href="#">현금영수증 샘플 <span
                    class="caret"></span></a>
                <ul class="dropdown-menu">
                    <li><a href="/cashSt">현금영수증 발행 </a></li>
                    <li><a href="/cashStCn">현금영수증 발행 취소 </a></li>

                </ul>
            </li>
        </ul>
    </div>
</nav>
