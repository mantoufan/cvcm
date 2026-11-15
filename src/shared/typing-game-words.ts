/**
 * Word lists for the typing game, written for cv.cm: common, everyday, family-friendly words per language.
 * zh entries are "simplified|traditional|toneless pinyin"; ja entries are "written form|hiragana reading".
 */
import type { Locale } from "./locale";
import type { TypingWord } from "./typing-game";

const EN = `apple table water house green happy river music paper smile garden window friend summer winter orange yellow
purple bread cheese pencil rabbit tiger monkey planet rocket ocean island forest flower cookie butter coffee guitar piano
dance sing jump laugh dream light cloud storm rain snow sunny beach shell sand wave boat train plane bicycle ticket
travel camera picture letter number circle square heart star moon earth stone metal silver golden candle lamp chair sofa
pillow blanket kitchen spoon plate glass bottle juice honey sugar salt pepper lemon cherry grape melon peach carrot potato
tomato onion salad pizza noodle soup rice cake candy chocolate school teacher student lesson library book story poem word
sentence question answer simple quick brown clever gentle brave quiet early later today tomorrow morning evening night
weekend holiday birthday party gift ribbon balloon puzzle game player score winner team ball goal kite swing slide
mountain valley desert jungle bridge castle tower street market shop money pocket button jacket shoe sock glove scarf
hat umbrella`;

const ES = `manzana mesa agua casa verde feliz río música papel sonrisa jardín ventana amigo verano invierno naranja amarillo
morado pan queso lápiz conejo tigre mono planeta cohete océano isla bosque flor galleta mantequilla café guitarra piano
bailar cantar saltar reír sueño luz nube tormenta lluvia nieve soleado playa concha arena ola barco tren avión bicicleta
billete viaje cámara foto carta número círculo cuadrado corazón estrella luna tierra piedra metal plata dorado vela lámpara
silla sofá almohada manta cocina cuchara plato vaso botella zumo miel azúcar sal pimienta limón cereza uva melón melocotón
zanahoria patata tomate cebolla ensalada sopa arroz pastel caramelo chocolate escuela maestro alumno lección biblioteca
libro cuento poema palabra pregunta respuesta rápido amable valiente tranquilo temprano hoy mañana tarde noche fiesta
regalo globo juego equipo pelota portería cometa montaña valle desierto selva puente castillo torre calle mercado tienda
dinero bolsillo botón chaqueta zapato calcetín guante bufanda sombrero paraguas camión ratón pájaro árbol jamón canción
corazón azul blanco negro rojo marrón gris rosa`;

const ID = `apel meja air rumah hijau senang sungai musik kertas senyum taman jendela teman musim dingin jeruk kuning ungu
roti keju pensil kelinci harimau monyet planet roket laut pulau hutan bunga kue mentega kopi gitar piano menari bernyanyi
melompat tertawa mimpi cahaya awan badai hujan salju cerah pantai kerang pasir ombak perahu kereta pesawat sepeda tiket
jalan kamera gambar surat angka lingkaran kotak hati bintang bulan bumi batu logam perak emas lilin lampu kursi sofa bantal
selimut dapur sendok piring gelas botol jus madu gula garam merica lemon ceri anggur melon persik wortel kentang tomat
bawang salad sup nasi permen cokelat sekolah guru murid pelajaran perpustakaan buku cerita puisi kata kalimat pertanyaan
jawaban mudah cepat cokelat pintar lembut berani tenang pagi siang sore malam besok hari ini liburan ulang tahun pesta
hadiah pita balon teka teki permainan pemain skor pemenang tim bola gol layangan ayunan gunung lembah gurun hutan jembatan
istana menara jalan raya pasar toko uang saku kancing jaket sepatu kaus kaki sarung tangan syal topi payung kucing anjing
burung ikan pohon daun langit merah biru putih hitam`;

/** simplified|traditional|pinyin */
const ZH = `苹果|蘋果|pingguo 桌子|桌子|zhuozi 喝水|喝水|heshui 房子|房子|fangzi 绿色|綠色|lvse 开心|開心|kaixin 河流|河流|heliu
音乐|音樂|yinyue 纸张|紙張|zhizhang 微笑|微笑|weixiao 花园|花園|huayuan 窗户|窗戶|chuanghu 朋友|朋友|pengyou 夏天|夏天|xiatian
冬天|冬天|dongtian 橙子|橙子|chengzi 黄色|黃色|huangse 紫色|紫色|zise 面包|麵包|mianbao 铅笔|鉛筆|qianbi 兔子|兔子|tuzi
老虎|老虎|laohu 猴子|猴子|houzi 星球|星球|xingqiu 火箭|火箭|huojian 海洋|海洋|haiyang 小岛|小島|xiaodao 森林|森林|senlin
花朵|花朵|huaduo 饼干|餅乾|binggan 咖啡|咖啡|kafei 吉他|吉他|jita 钢琴|鋼琴|gangqin 跳舞|跳舞|tiaowu 唱歌|唱歌|changge
跳绳|跳繩|tiaosheng 大笑|大笑|daxiao 梦想|夢想|mengxiang 灯光|燈光|dengguang 白云|白雲|baiyun 下雨|下雨|xiayu 雪花|雪花|xuehua
晴天|晴天|qingtian 沙滩|沙灘|shatan 贝壳|貝殼|beike 海浪|海浪|hailang 小船|小船|xiaochuan 火车|火車|huoche 飞机|飛機|feiji
自行车|自行車|zixingche 车票|車票|chepiao 旅行|旅行|lvxing 相机|相機|xiangji 照片|照片|zhaopian 信封|信封|xinfeng 数字|數字|shuzi
圆圈|圓圈|yuanquan 方形|方形|fangxing 爱心|愛心|aixin 星星|星星|xingxing 月亮|月亮|yueliang 地球|地球|diqiu 石头|石頭|shitou
银色|銀色|yinse 金色|金色|jinse 蜡烛|蠟燭|lazhu 台灯|檯燈|taideng 椅子|椅子|yizi 沙发|沙發|shafa 枕头|枕頭|zhentou
毯子|毯子|tanzi 厨房|廚房|chufang 勺子|勺子|shaozi 盘子|盤子|panzi 杯子|杯子|beizi 瓶子|瓶子|pingzi 果汁|果汁|guozhi
蜂蜜|蜂蜜|fengmi 白糖|白糖|baitang 柠檬|檸檬|ningmeng 樱桃|櫻桃|yingtao 葡萄|葡萄|putao 西瓜|西瓜|xigua 桃子|桃子|taozi
胡萝卜|胡蘿蔔|huluobo 土豆|土豆|tudou 番茄|番茄|fanqie 洋葱|洋蔥|yangcong 沙拉|沙拉|shala 汤面|湯麵|tangmian 米饭|米飯|mifan
蛋糕|蛋糕|dangao 糖果|糖果|tangguo 巧克力|巧克力|qiaokeli 学校|學校|xuexiao 老师|老師|laoshi 学生|學生|xuesheng
上课|上課|shangke 图书馆|圖書館|tushuguan 书本|書本|shuben 故事|故事|gushi 诗歌|詩歌|shige 汉字|漢字|hanzi 句子|句子|juzi
问题|問題|wenti 答案|答案|daan 简单|簡單|jiandan 快速|快速|kuaisu 聪明|聰明|congming 温柔|溫柔|wenrou 勇敢|勇敢|yonggan
安静|安靜|anjing 早上|早上|zaoshang 晚上|晚上|wanshang 今天|今天|jintian 明天|明天|mingtian 周末|週末|zhoumo 假期|假期|jiaqi
生日|生日|shengri 派对|派對|paidui 礼物|禮物|liwu 气球|氣球|qiqiu 拼图|拼圖|pintu 游戏|遊戲|youxi 球队|球隊|qiudui
足球|足球|zuqiu 风筝|風箏|fengzheng 秋千|鞦韆|qiuqian 高山|高山|gaoshan 山谷|山谷|shangu 沙漠|沙漠|shamo 大桥|大橋|daqiao
城堡|城堡|chengbao 高塔|高塔|gaota 街道|街道|jiedao 市场|市場|shichang 商店|商店|shangdian 钱包|錢包|qianbao 口袋|口袋|koudai
扣子|扣子|kouzi 外套|外套|waitao 鞋子|鞋子|xiezi 袜子|襪子|wazi 手套|手套|shoutao 围巾|圍巾|weijin 帽子|帽子|maozi
雨伞|雨傘|yusan 小猫|小貓|xiaomao 小狗|小狗|xiaogou 小鸟|小鳥|xiaoniao 金鱼|金魚|jinyu 大树|大樹|dashu 树叶|樹葉|shuye
天空|天空|tiankong 红色|紅色|hongse 蓝色|藍色|lanse 白色|白色|baise 黑色|黑色|heise 电脑|電腦|diannao 手机|手機|shouji
键盘|鍵盤|jianpan 冰箱|冰箱|bingxiang 太阳|太陽|taiyang 彩虹|彩虹|caihong 熊猫|熊貓|xiongmao 大象|大象|daxiang 长颈鹿|長頸鹿|changjinglu
蝴蝶|蝴蝶|hudie 蜜蜂|蜜蜂|mifeng 春天|春天|chuntian 秋天|秋天|qiutian 中国|中國|zhongguo 北京|北京|beijing 上海|上海|shanghai
你好|你好|nihao 谢谢|謝謝|xiexie 再见|再見|zaijian 加油|加油|jiayou 快乐|快樂|kuaile 家人|家人|jiaren 妈妈|媽媽|mama
爸爸|爸爸|baba 哥哥|哥哥|gege 妹妹|妹妹|meimei 早餐|早餐|zaocan 午饭|午飯|wufan 晚餐|晚餐|wancan 散步|散步|sanbu`;

/** written form|hiragana reading */
const JA = `りんご|りんご 机|つくえ 水|みず 家|いえ 緑|みどり 川|かわ 音楽|おんがく 紙|かみ 笑顔|えがお 庭|にわ 窓|まど 友達|ともだち
夏|なつ 冬|ふゆ 春|はる 秋|あき 黄色|きいろ 紫|むらさき パン|ぱん チーズ|ちーず 鉛筆|えんぴつ うさぎ|うさぎ 虎|とら 猿|さる
星|ほし ロケット|ろけっと 海|うみ 島|しま 森|もり 花|はな クッキー|くっきー コーヒー|こーひー ギター|ぎたー ピアノ|ぴあの
踊る|おどる 歌う|うたう 跳ぶ|とぶ 笑う|わらう 夢|ゆめ 光|ひかり 雲|くも 嵐|あらし 雨|あめ 雪|ゆき 晴れ|はれ 浜辺|はまべ
貝|かい 砂|すな 波|なみ 船|ふね 電車|でんしゃ 飛行機|ひこうき 自転車|じてんしゃ 切符|きっぷ 旅行|りょこう カメラ|かめら
写真|しゃしん 手紙|てがみ 数字|すうじ 丸|まる 四角|しかく 心|こころ 月|つき 地球|ちきゅう 石|いし 銀|ぎん 金色|きんいろ
ろうそく|ろうそく 電気|でんき 椅子|いす 枕|まくら 毛布|もうふ 台所|だいどころ スプーン|すぷーん お皿|おさら コップ|こっぷ
瓶|びん ジュース|じゅーす 蜂蜜|はちみつ 砂糖|さとう 塩|しお 胡椒|こしょう レモン|れもん さくらんぼ|さくらんぼ ぶどう|ぶどう
メロン|めろん 桃|もも 人参|にんじん じゃがいも|じゃがいも トマト|とまと 玉ねぎ|たまねぎ サラダ|さらだ スープ|すーぷ
ご飯|ごはん ケーキ|けーき お菓子|おかし チョコレート|ちょこれーと 学校|がっこう 先生|せんせい 生徒|せいと 授業|じゅぎょう
図書館|としょかん 本|ほん 物語|ものがたり 詩|し 言葉|ことば 質問|しつもん 答え|こたえ 簡単|かんたん 速い|はやい 優しい|やさしい
勇気|ゆうき 静か|しずか 朝|あさ 昼|ひる 夜|よる 今日|きょう 明日|あした 週末|しゅうまつ 休み|やすみ 誕生日|たんじょうび
お祝い|おいわい 贈り物|おくりもの 風船|ふうせん パズル|ぱずる ゲーム|げーむ 選手|せんしゅ 点数|てんすう 仲間|なかま
ボール|ぼーる 凧|たこ ぶらんこ|ぶらんこ 山|やま 谷|たに 砂漠|さばく 橋|はし お城|おしろ 塔|とう 道|みち 市場|いちば
お店|おみせ お金|おかね ポケット|ぽけっと ボタン|ぼたん 上着|うわぎ 靴|くつ 靴下|くつした 手袋|てぶくろ 帽子|ぼうし
傘|かさ 猫|ねこ 犬|いぬ 鳥|とり 魚|さかな 木|き 葉っぱ|はっぱ 空|そら 赤|あか 青|あお 白|しろ 黒|くろ パソコン|ぱそこん
携帯|けいたい 太陽|たいよう 虹|にじ パンダ|ぱんだ 象|ぞう きりん|きりん 蝶|ちょう 新幹線|しんかんせん 富士山|ふじさん
東京|とうきょう 京都|きょうと 寿司|すし 天ぷら|てんぷら お茶|おちゃ 抹茶|まっちゃ 学生|がくせい 元気|げんき
ありがとう|ありがとう こんにちは|こんにちは 散歩|さんぽ 料理|りょうり 掃除|そうじ 洗濯|せんたく 勉強|べんきょう 漢字|かんじ`;

const KO = `사과 책상 물 집 초록 행복 강 음악 종이 미소 정원 창문 친구 여름 겨울 봄 가을 오렌지 노랑 보라 빵 치즈 연필 토끼
호랑이 원숭이 행성 로켓 바다 섬 숲 꽃 쿠키 버터 커피 기타 피아노 춤 노래 점프 웃음 꿈 빛 구름 폭풍 비 눈 맑음
해변 조개 모래 파도 배 기차 비행기 자전거 표 여행 카메라 사진 편지 숫자 동그라미 네모 하트 별 달 지구 돌 은 금
양초 전등 의자 소파 베개 이불 부엌 숟가락 접시 컵 병 주스 꿀 설탕 소금 후추 레몬 체리 포도 멜론 복숭아 당근 감자
토마토 양파 샐러드 수프 밥 케이크 사탕 초콜릿 학교 선생님 학생 수업 도서관 책 이야기 시 단어 문장 질문 대답 쉬움
빠름 똑똑함 다정함 용기 조용함 아침 점심 저녁 밤 오늘 내일 주말 휴가 생일 파티 선물 리본 풍선 퍼즐 게임 선수
점수 승리 팀 공 골 연 그네 산 계곡 사막 정글 다리 성 탑 거리 시장 가게 돈 주머니 단추 외투 신발 양말 장갑
목도리 모자 우산 고양이 강아지 새 물고기 나무 나뭇잎 하늘 빨강 파랑 하양 검정 컴퓨터 휴대폰 키보드 태양 무지개
판다 코끼리 기린 나비 꿀벌 김치 비빔밥 떡볶이 한글 서울 부산 안녕 감사 가족 엄마 아빠 언니 동생 산책 요리 청소`;

const parsePlain = (s: string): TypingWord[] => [...new Set(s.split(/\s+/).filter(Boolean))].map((text) => ({ text }));
// Vietnamese entries keep their spaces: each entry is one word or one two-syllable compound.
const VI_WORDS = [
  "táo", "bàn", "nước", "nhà", "xanh", "vui", "sông", "nhạc", "giấy", "cười", "vườn", "cửa sổ", "bạn", "mùa hè", "mùa đông",
  "cam", "vàng", "tím", "bánh mì", "phô mai", "bút chì", "thỏ", "hổ", "khỉ", "hành tinh", "tên lửa", "biển", "đảo", "rừng",
  "hoa", "bánh quy", "bơ", "cà phê", "múa", "hát", "nhảy", "mơ", "ánh sáng", "mây", "bão", "mưa", "tuyết", "nắng",
  "bãi biển", "vỏ sò", "cát", "sóng", "thuyền", "tàu", "máy bay", "xe đạp", "vé", "du lịch", "máy ảnh", "bức tranh", "thư",
  "số", "hình tròn", "hình vuông", "trái tim", "ngôi sao", "mặt trăng", "trái đất", "đá", "kim loại", "bạc", "nến", "đèn",
  "ghế", "gối", "chăn", "nhà bếp", "thìa", "đĩa", "cốc", "chai", "nước ép", "mật ong", "đường", "muối", "tiêu", "chanh",
  "anh đào", "nho", "dưa hấu", "đào", "cà rốt", "khoai tây", "cà chua", "hành tây", "canh", "cơm", "bánh", "kẹo",
  "sô cô la", "trường học", "thầy giáo", "học sinh", "bài học", "thư viện", "sách", "truyện", "thơ", "chữ", "câu hỏi",
  "câu trả lời", "dễ", "nhanh", "thông minh", "hiền", "dũng cảm", "yên tĩnh", "buổi sáng", "buổi trưa", "buổi chiều",
  "buổi tối", "ngày mai", "hôm nay", "kỳ nghỉ", "sinh nhật", "bữa tiệc", "quà", "bóng bay", "trò chơi", "người chơi",
  "điểm", "đội", "quả bóng", "diều", "xích đu", "núi", "thung lũng", "sa mạc", "cây cầu", "lâu đài", "tháp", "đường phố",
  "chợ", "cửa hàng", "tiền", "túi", "áo khoác", "giày", "tất", "găng tay", "khăn quàng", "mũ", "ô", "con mèo", "con chó",
  "con chim", "con cá", "cây", "lá", "bầu trời", "màu đỏ", "màu trắng", "màu đen", "máy tính", "điện thoại", "mặt trời",
  "cầu vồng", "gấu trúc", "con voi", "hươu cao cổ", "con bướm", "con ong", "phở", "áo dài", "Hà Nội", "xin chào", "cảm ơn",
  "gia đình", "mẹ", "bố", "anh trai", "em gái", "đi dạo", "nấu ăn",
].map((text) => ({ text }));

// Indonesian and English lists hold a few two-word entries; keep those as entries.
const ID_EXTRA = ["musim dingin", "hari ini", "ulang tahun", "teka teki", "jalan raya", "kaus kaki", "sarung tangan"];

const zhWords = (traditional: boolean): TypingWord[] =>
  ZH.split(/\s+/).filter(Boolean).map((e) => {
    const [s, t, py] = e.split("|") as [string, string, string];
    return { text: traditional ? t : s, reading: py };
  });

const jaWords = (): TypingWord[] =>
  JA.split(/\s+/).filter(Boolean).map((e) => {
    const [text, reading] = e.split("|") as [string, string];
    return { text, reading };
  });

const idWords = (): TypingWord[] => {
  const extra = new Set(ID_EXTRA.flatMap((w) => w.split(" ")));
  const singles = ID.split(/\s+/).filter((w) => w && !extra.has(w));
  return [...new Set([...singles, ...ID_EXTRA])].map((text) => ({ text }));
};

let cache: Partial<Record<Locale, TypingWord[]>> = {};

export function wordsFor(locale: Locale): TypingWord[] {
  if (!cache[locale]) {
    cache = {
      ...cache,
      [locale]:
        locale === "es" ? parsePlain(ES)
        : locale === "id" ? idWords()
        : locale === "vi" ? VI_WORDS
        : locale === "zh-CN" ? zhWords(false)
        : locale === "zh-TW" ? zhWords(true)
        : locale === "ja" ? jaWords()
        : locale === "ko" ? parsePlain(KO)
        : parsePlain(EN),
    };
  }
  return cache[locale]!;
}
