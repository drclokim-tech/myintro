# 공공 AX 네트워크 2,700명 돌파 축하 영상 (CesiumJS)

세로형(1080×1920, 30fps, 60초) 로켓 발사 영상입니다. 시나리오는 [`SCENARIO.md`](SCENARIO.md)에 있습니다.

- 발사 위치: 정부세종청사 인근(세종호수공원). 청사 건물은 대략적인 형태로 재현했습니다
- 기체: 누리호풍 3단 로켓(47 m, 태극기와 '대한민국' 마킹). 1단 분리 연출 포함
- 고도 = 참여자 수 (1명 = 1 km). 날짜가 2026.01.01 → 2026.10.29로 빠르게 넘어가면서 0 → 2,700명
- 2,700명 도달 시 "축하!" 자막과 불꽃, 이후 숫자가 ∞로 바뀌며 NASA 성운 속으로 비행 → ∞ 엔딩
- Cesium ion 토큰 없이 동작합니다(지구 텍스처는 `three-globe` 패키지의 NASA Blue Marble / Black Marble 이미지 사용)

## 필요한 에셋 (`assets/`)

| 파일 | 내용 |
|---|---|
| `assets/nebula.jpg` (또는 .png/.webp) | NASA 성운 사진 (예: JWST 카리나 성운 "Cosmic Cliffs"). NASA 이미지는 퍼블릭 도메인 |
| `assets/aks-logo.png` (또는 .svg) | 한국학중앙연구원 로고, 투명 배경 PNG 권장 |

파일이 없으면 해당 위치에 점선 박스로 자리 표시가 나타납니다.

## 렌더링

```bash
npm install
node render.js --scale 0.5 --stills 5,19,30,43,52,58   # 저해상도 확인용 정지 컷 → output/stills/
node render.js --workers 2                              # 전체 영상 → output/ax-2700.mp4
node render.js --audio bgm.mp3                          # 배경음악 합성
```

헤드리스 Chromium에서 프레임 단위로 시간을 고정해 캡처하므로 끊김 없는 영상이 나옵니다. 이미 렌더링된 프레임(`output/frames/`)은 건너뛰기 때문에 중단돼도 이어서 렌더링할 수 있습니다.
