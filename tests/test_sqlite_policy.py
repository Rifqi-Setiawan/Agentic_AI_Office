import pytest
from src.mission_control.api import sqlite_wal_is_patched

@pytest.mark.parametrize('version,expected', [
    ((3,40,1),False), ((3,44,5),False), ((3,44,6),True), ((3,45,3),False),
    ((3,50,6),False), ((3,50,7),True), ((3,51,2),False), ((3,51,3),True), ((3,53,2),True),
])
def test_wal_fix_version_policy(version, expected):
    assert sqlite_wal_is_patched(version) is expected
