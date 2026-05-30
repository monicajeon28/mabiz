package com.udid.payapp_android_sample_v3;

import android.os.Bundle;
import android.view.View;
import android.widget.Button;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentActivity;
import androidx.viewpager2.adapter.FragmentStateAdapter;
import androidx.viewpager2.widget.ViewPager2;

import com.udid.applink.model.type.PAReqType;

/**
 * Create by 김진원
 *
 */
public class AppLinkActivity extends AppCompatActivity implements View.OnClickListener{


    private ViewPager2 mPager;
    private FragmentStateAdapter pagerAdapter;
    private int num_page = 2;


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_app_link);


        mPager = findViewById(R.id.viewpager);
        pagerAdapter = new AppLinkPagerAdapter(this, num_page);
        mPager.setAdapter(pagerAdapter);
        mPager.setOrientation(ViewPager2.ORIENTATION_HORIZONTAL);
        mPager.setCurrentItem(0);
        mPager.setOffscreenPageLimit(num_page);
        mPager.registerOnPageChangeCallback(new ViewPager2.OnPageChangeCallback() {
            @Override
            public void onPageScrolled(int position, float positionOffset, int positionOffsetPixels) {
                super.onPageScrolled(position, positionOffset, positionOffsetPixels);
                if (positionOffsetPixels == 0) {
                    mPager.setCurrentItem(position);
                }
            }

            @Override
            public void onPageSelected(int position) {
                super.onPageSelected(position);
            }

        });


        findViewById(R.id.paymentBtn).setOnClickListener(this);
        findViewById(R.id.cashReceiptBtn).setOnClickListener(this);

        findViewById(R.id.closeBtn).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });
    }

    @Override
    public void onClick(View v) {
        int id = v.getId();
        if (id == R.id.paymentBtn) {
            mPager.setCurrentItem(0);
        } else if (id == R.id.cashReceiptBtn) {
            mPager.setCurrentItem(1);
        }
    }


    public class AppLinkPagerAdapter extends FragmentStateAdapter {

        public int mCount;

        public AppLinkPagerAdapter(FragmentActivity fa, int count) {
            super(fa);
            mCount = count;
        }

        @NonNull
        @Override
        public Fragment createFragment(int position) {
            int index = getRealPosition(position);

            if(index == 0) return new PaymentFragment();
            else if(index == 1) return new CashReceiptFragment();
            else return new PaymentFragment();

        }

        @Override
        public int getItemCount() {
            return mCount;
        }

        public int getRealPosition(int position) { return position % mCount; }

    }
}
