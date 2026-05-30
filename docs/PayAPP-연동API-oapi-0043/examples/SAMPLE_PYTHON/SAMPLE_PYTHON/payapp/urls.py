
from django.conf.urls import url
from . import views

"$ 현재"
".+ 어떤 패턴도 허용 "
"\d+ 번호 패턴허용 "
urlpatterns = [
    url(r'^$', views.index),
    url(r'payrequest', views.payrequest),
    url(r'payRequestCancel', views.payRequestCancel),
    url(r'payRequestCancel2', views.payRequestCancel),
    url(r'payRegularRequest', views.payRegularRequest),
    url(r'payRegularRequestCancel', views.payRegularRequestCancel),
    url(r'subidRegist', views.subidRegist),
    url(r'payappCashSt', views.payappCashSt),
    url(r'payappCashStCn', views.payappCashStCn),
]
