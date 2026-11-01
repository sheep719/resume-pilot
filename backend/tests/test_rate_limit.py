"""限流模块单测：双层窗口（每 IP 每小时 + 全局每天）"""
import time

import pytest

from app import rate_limit


@pytest.fixture(autouse=True)
def _reset():
    rate_limit._ip_hits.clear()
    rate_limit._global_hits.clear()
    yield
    rate_limit._ip_hits.clear()
    rate_limit._global_hits.clear()


class TestIpHourlyLimit:
    def test_under_limit_passes(self):
        assert rate_limit.check("1.1.1.1") is None

    def test_over_limit_rejects(self):
        for _ in range(rate_limit.HOURLY_PER_IP):
            rate_limit.record("1.1.1.1")
        assert rate_limit.check("1.1.1.1") is not None

    def test_other_ips_unaffected(self):
        for _ in range(rate_limit.HOURLY_PER_IP):
            rate_limit.record("1.1.1.1")
        assert rate_limit.check("2.2.2.2") is None

    def test_window_slide(self):
        """一小时前的记录不计入当前窗口"""
        old = time.time() - 3700
        rate_limit._ip_hits["1.1.1.1"] = [old] * rate_limit.HOURLY_PER_IP
        assert rate_limit.check("1.1.1.1") is None


class TestGlobalDailyLimit:
    def test_over_limit_rejects(self):
        rate_limit._global_hits.extend([time.time()] * rate_limit.DAILY_GLOBAL)
        assert rate_limit.check("9.9.9.9") is not None  # 新 IP 也被拒

    def test_day_old_records_dropped(self):
        rate_limit._global_hits.extend([time.time() - 86500] * rate_limit.DAILY_GLOBAL)
        assert rate_limit.check("9.9.9.9") is None

    def test_remaining_counts(self):
        rate_limit.record("1.1.1.1")
        rate_limit.record("2.2.2.2")
        assert rate_limit.remaining_today() == rate_limit.DAILY_GLOBAL - 2
