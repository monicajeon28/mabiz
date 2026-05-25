#!/usr/bin/env python3
"""
정확한 import 감사: 실제 파일 존재 + 런타임 에러만 확인
"""
import os
import re
from pathlib import Path
from collections import defaultdict

API_DIR = r"D:\mabiz-crm\src\app\api"
LIB_DIR = r"D:\mabiz-crm\src\lib"

# 실제 존재하는 모듈만 체크 (파일 시스템 기반)
existing_lib_modules = set()
for root, dirs, files in os.walk(LIB_DIR):
    for file in files:
        if file.endswith(('.ts', '.tsx')):
            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, LIB_DIR)
            module_name = rel_path.replace('\\', '/').replace('.tsx', '').replace('.ts', '')
            existing_lib_modules.add(f"@/lib/{module_name}")

# 모든 route.ts 검사
issues = defaultdict(list)
total_routes = 0
broken_imports = []

for root, dirs, files in os.walk(API_DIR):
    for file in files:
        if file == "route.ts":
            file_path = os.path.join(root, file)
            total_routes += 1

            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()

                    # 모든 import 문 추출
                    import_lines = re.findall(r'import\s+.*?\s+from\s+["\']([^"\']+)["\']', content)

                    for import_path in import_lines:
                        # @/lib 패턴만 확인
                        if import_path.startswith('@/lib'):
                            if import_path not in existing_lib_modules:
                                # 더 깊은 검색 (디렉토리 기반)
                                base_check = import_path
                                found = False

                                # 정확한 매칭 시도
                                if base_check in existing_lib_modules:
                                    found = True

                                # 인덱스 파일 시도
                                if f"{base_check}/index" in str(existing_lib_modules):
                                    found = True

                                if not found:
                                    broken_imports.append({
                                        'file': os.path.relpath(file_path, API_DIR),
                                        'import': import_path
                                    })

            except Exception as e:
                pass

# 결과 출력
print(f"총 route.ts 파일: {total_routes}")
print(f"실제 missing @/lib modules: {len(broken_imports)}")

if broken_imports:
    print("\n실제 문제 있는 import:")
    for item in broken_imports[:10]:
        print(f"  {item['file']}")
        print(f"    -> {item['import']}")
else:
    print("\n✅ 모든 @/lib import이 올바릅니다!")

# lib 모듈 목록 출력
print(f"\n등록된 @/lib 모듈 ({len(existing_lib_modules)}개, 처음 20개):")
for mod in sorted(existing_lib_modules)[:20]:
    print(f"  {mod}")
