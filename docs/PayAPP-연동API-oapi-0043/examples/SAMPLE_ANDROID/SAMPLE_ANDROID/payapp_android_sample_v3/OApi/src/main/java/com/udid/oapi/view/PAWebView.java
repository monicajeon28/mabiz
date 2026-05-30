package com.udid.oapi.view;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Message;
import android.util.AttributeSet;
import android.util.Log;
import android.view.ViewGroup;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.RequiresApi;


import com.udid.oapi.PAOAPIConstValue;

import java.net.URISyntaxException;

/**
 * Create by 김진원
 */
public class PAWebView extends WebView {


    public final static String RETURN_URI = "payappsamplev3://payment.result";

    private Activity activity;

    public PAWebView(@NonNull Context context) {
        super(context);
    }

    public PAWebView(@NonNull Context context, @Nullable AttributeSet attrs) {
        super(context, attrs);
    }

    public PAWebView(@NonNull Context context, @Nullable AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
    }

    @Override
    public void loadUrl(@NonNull String url) {
        super.loadUrl(url);

    }

    @SuppressLint("SetJavaScriptEnabled")
    public void init(Activity activity) {
        this.activity = activity;

        this.getSettings().setJavaScriptEnabled(true);
        this.getSettings().setDomStorageEnabled(true);
        this.getSettings().setSupportMultipleWindows(true);
        this.getSettings().setJavaScriptCanOpenWindowsAutomatically(true);
        this.setPAWebViewClient();
        this.setPAWebChromeClient();
    }

    /**
     * Android11의 패키지 가시성 정책 변경으로 PackageManager에서 제공하는 메소드를 이용한 결제앱 설치 여부를 확인 불가하다.
     * 이를 해결하기 위해 AndroidManifest에 <queries>요소에 패키지를 정의한다.
     */
    public void  setPAWebViewClient() {

        this.setWebViewClient(new WebViewClient() {

            @RequiresApi(api = Build.VERSION_CODES.LOLLIPOP)
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String url = uri.toString();
                Context context = view.getContext();

                try {
                    if (url.startsWith("intent:")
                            || url.contains("market://")
                            || url.contains("vguard")
                            || url.contains("droidxantivirus")
                            || url.contains("v3mobile")
                            || url.contains(".apk")
                            || url.contains("mvaccine")
                            || url.contains("smartwall://")
                            || url.contains("nidlogin://")
                            || url.contains("onestore://")
                            || url.contains("http://m.ahnlab.com/kr/site/download") ) {

                        Intent intent;

                        try {
                            intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                        } catch (URISyntaxException ex) {
                            return false;
                        }

                        if (context.getPackageManager().resolveActivity(intent,0) == null) {
                            // 앱 미설치
                        } else {
                            Uri parseUri = Uri.parse(intent.getDataString());
                            intent = new Intent(Intent.ACTION_VIEW, parseUri);
                            context.startActivity(intent);
                        }
                    } else {
                        /**
                         * App Link(https://payapp.kr/sdk-app)로 호출 시 앱에서 직접 호출한다.
                         */
                        if (url.startsWith(PAOAPIConstValue.PAYAPP_APP_LINK)) {
                            /**
                             * 웹 returnUri를 앱에서 받을 수 있게 전환
                             */
                            url = url.replace("returnUri=https://my_returnUrl.kr", "returnUri=" + RETURN_URI);
                            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                            context.startActivity(intent);
                        } else {
                            view.loadUrl(url);
                        }
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    return false;
                }

                return true;
            }
        });
    }

    public void setPAWebChromeClient() {
        this.setWebChromeClient(new CustomWebChromeClient());
    }
    private class CustomWebChromeClient extends WebChromeClient {

        @Override
        public void onProgressChanged(WebView view, int newProgress) {
        }

        @Override
        public boolean onJsAlert(WebView view, String url, String message, final JsResult result) {

            new AlertDialog.Builder(activity)
                    .setTitle("알림")
                    .setMessage(message)
                    .setPositiveButton(android.R.string.ok,
                            new AlertDialog.OnClickListener() {
                                public void onClick(DialogInterface dialog, int which) {
                                    result.confirm();
                                }
                            })
                    .setCancelable(false)
                    .create()
                    .show();
            return true;
        }

        @Override
        public boolean onJsConfirm(WebView view, String url, String message, final JsResult result) {

            new AlertDialog.Builder(activity)
                    .setTitle("알림")
                    .setMessage(message)
                    .setPositiveButton(android.R.string.ok,
                            new DialogInterface.OnClickListener() {
                                public void onClick(DialogInterface dialog, int which) {
                                    result.confirm();
                                }
                            })
                    .setNegativeButton(android.R.string.cancel,
                            new DialogInterface.OnClickListener() {
                                @Override
                                public void onClick(DialogInterface dialog, int which) {
                                    result.cancel();
                                }
                            })
                    .create()
                    .show();
            return true;
        }

        @Override
        public boolean onCreateWindow(WebView view, boolean isDialog,
                                      boolean isUserGesture, Message resultMsg) {

            PAWebView paWebView = new PAWebView(activity);
            paWebView.init(activity);
            LinearLayout.LayoutParams webViewParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
            addView(paWebView, 0, webViewParams);
            invalidate();

            WebViewTransport transport = (WebViewTransport) resultMsg.obj;
            transport.setWebView(paWebView);
            resultMsg.sendToTarget();
            return true;
        }

        @Override
        public void onCloseWindow(WebView window) {
            super.onCloseWindow(window);
        }
    }

}
