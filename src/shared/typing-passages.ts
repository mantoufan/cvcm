import type { Locale } from "./locale";

/** Three practice passages per locale. Plain ASCII quotes in Latin scripts; full-width punctuation in CJK. */
export const TYPING_PASSAGES: Record<Locale, readonly string[]> = {
  en: [
    "The morning train was quiet, so I opened my notebook and wrote down the plan for the week. First I would fix the leaking tap in the kitchen, then call my sister, and on Friday I would finally return the library books that had been sitting by the door for a month. Small lists like this never look impressive, but crossing off one line at a time is how most real work gets done.",
    "A good cup of tea needs only three things: fresh water, the right temperature, and a little patience. Green tea likes water that has cooled for a minute after boiling, while black tea is happy with it straight from the kettle. Let the leaves steep for three to four minutes, then pour. If it tastes bitter, the water was too hot or you waited too long, so try again tomorrow.",
    "When you learn to type without looking at the keys, speed comes last. Keep your fingers resting on the home row, reach for each letter with the same finger every time, and accept that you will be slow for a week or two. Accuracy builds the habit; the habit builds the speed. Most people who type fast simply made fewer mistakes for long enough that their hands stopped thinking.",
  ],
  "zh-CN": [
    "周末的早上，我喜欢先去楼下的早餐店买一碗豆浆和两根油条，再慢慢走到公园里。湖边总有人在打太极，也有老人提着鸟笼聊天。走上一圈回来，太阳刚好晒到阳台，泡一壶茶，把这一周没看完的书翻出来，日子好像一下子就慢了下来。",
    "学打字最重要的不是快，而是准。手指放在基准键上，每个字母都用固定的手指去按，刚开始会觉得别扭，速度也会变慢。坚持一两个星期，手指自己就记住了位置，不用再低头看键盘，速度自然就上来了。",
    "做饭其实没有想象中那么难。先把要用的菜洗好切好，调料放在手边，再开火。锅烧热了再倒油，油热了再下菜，这样不容易粘锅。盐最后放，尝一尝再决定要不要加。多做几次，你就会知道自己喜欢什么味道。",
  ],
  "zh-TW": [
    "週末的早上，我喜歡先到樓下的早餐店買一杯豆漿和一份蛋餅，再慢慢走到公園。湖邊總有人在打太極，也有長輩坐在樹下聊天。散步一圈回來，陽光剛好照進陽台，泡一壺茶，把這週還沒看完的書拿出來，日子好像一下子就慢了下來。",
    "學打字最重要的不是快，而是準。手指放在基準鍵上，每個鍵都用固定的手指去按，一開始會覺得彆扭，速度也會變慢。持續練習一兩個星期，手指自己就會記住位置，不用再低頭看鍵盤，速度自然就上來了。",
    "做菜其實沒有想像中那麼難。先把要用的食材洗好切好，調味料放在手邊，再開火。鍋子燒熱了再倒油，油熱了再下菜，這樣比較不會黏鍋。鹽最後再加，嚐一嚐再決定要不要多放。多煮幾次，你就會知道自己喜歡什麼味道。",
  ],
  ja: [
    "週末の朝は、近所のパン屋で焼きたてのクロワッサンを買ってから、ゆっくり公園まで歩くのが好きです。池のまわりでは犬の散歩をする人や、ベンチで新聞を読む人がいます。家に戻ってお茶をいれ、読みかけの本を開くと、時間がいつもより静かに流れていく気がします。",
    "タイピングを覚えるときに大切なのは、速さよりも正確さです。指をホームポジションに置き、同じキーはいつも同じ指で押すようにします。最初は遅くてもどかしいですが、一、二週間続けると手が位置を覚え、キーボードを見なくても打てるようになります。",
    "料理は思っているほど難しくありません。まず材料を洗って切り、調味料を手の届くところに並べてから火をつけます。フライパンをしっかり温めてから油を入れると、焦げつきにくくなります。塩は最後に少しずつ加え、味見をしながら決めましょう。",
  ],
  ko: [
    "주말 아침이면 동네 빵집에서 갓 구운 빵을 사서 천천히 공원까지 걸어갑니다. 호숫가에는 강아지와 산책하는 사람들, 벤치에서 신문을 읽는 어르신들이 있습니다. 집에 돌아와 차를 한 잔 우리고 읽다 만 책을 펼치면 시간이 조금 느리게 흐르는 것 같습니다.",
    "타자를 배울 때 가장 중요한 것은 속도보다 정확도입니다. 손가락을 기본 자리에 올려 두고, 같은 키는 항상 같은 손가락으로 누르세요. 처음에는 느리고 답답하지만 한두 주만 꾸준히 연습하면 손이 자리를 기억해서 자판을 보지 않고도 칠 수 있게 됩니다.",
    "요리는 생각보다 어렵지 않습니다. 먼저 재료를 씻어서 썰고, 양념은 손이 닿는 곳에 놓은 다음 불을 켭니다. 팬을 충분히 달군 뒤에 기름을 두르면 잘 눌어붙지 않습니다. 소금은 마지막에 조금씩 넣고 맛을 보면서 정하세요.",
  ],
  vi: [
    "Sáng cuối tuần, tôi thích ghé quán quen đầu ngõ ăn một bát phở rồi đi bộ ra hồ. Quanh hồ có người chạy bộ, có các cụ ngồi đánh cờ dưới gốc cây. Về đến nhà, tôi pha một ấm trà, mở cuốn sách còn đọc dở, và thấy thời gian như trôi chậm lại.",
    "Khi học gõ phím, điều quan trọng nhất không phải là nhanh mà là chính xác. Hãy đặt các ngón tay lên hàng phím cơ sở và luôn dùng đúng một ngón cho mỗi phím. Lúc đầu bạn sẽ thấy chậm và hơi khó chịu, nhưng chỉ sau một hai tuần, tay sẽ tự nhớ vị trí và bạn không cần nhìn bàn phím nữa.",
    "Nấu ăn không khó như nhiều người nghĩ. Trước tiên hãy rửa và thái sẵn nguyên liệu, để gia vị ở gần tay rồi mới bật bếp. Làm nóng chảo trước khi cho dầu vào thì đồ ăn ít bị dính. Muối nên nêm sau cùng, nếm thử rồi mới quyết định có thêm hay không.",
  ],
  id: [
    "Setiap Sabtu pagi, saya suka membeli nasi uduk di warung dekat rumah lalu berjalan pelan ke taman. Di sekitar danau ada orang yang berlari, ada juga bapak-bapak yang mengobrol sambil minum kopi. Sesampainya di rumah, saya menyeduh teh, membuka buku yang belum selesai dibaca, dan waktu terasa berjalan lebih lambat.",
    "Saat belajar mengetik, yang paling penting bukan kecepatan, melainkan ketepatan. Letakkan jari di baris tengah keyboard dan tekan setiap tombol dengan jari yang sama. Awalnya memang terasa lambat dan canggung, tetapi setelah satu atau dua minggu, tangan akan hafal posisinya dan Anda tidak perlu melihat keyboard lagi.",
    "Memasak sebenarnya tidak sesulit yang dibayangkan. Cuci dan potong semua bahan lebih dulu, siapkan bumbu di dekat kompor, baru nyalakan api. Panaskan wajan sebelum menuang minyak supaya masakan tidak lengket. Tambahkan garam di akhir, cicipi dulu, lalu putuskan apakah perlu ditambah.",
  ],
  es: [
    "Los sábados por la mañana me gusta comprar pan recién hecho en la panadería de la esquina y caminar sin prisa hasta el parque. Junto al lago siempre hay gente corriendo y vecinos que charlan en los bancos. Al volver a casa preparo un café, abro el libro que tengo a medias y el tiempo parece pasar más despacio.",
    "Cuando aprendes a escribir a máquina, lo más importante no es la velocidad, sino la precisión. Apoya los dedos en la fila central del teclado y pulsa cada tecla siempre con el mismo dedo. Al principio irás lento y te costará, pero en una o dos semanas tus manos recordarán las posiciones y ya no tendrás que mirar el teclado.",
    "Cocinar no es tan difícil como parece. Primero lava y corta todos los ingredientes, deja las especias a mano y solo entonces enciende el fuego. Calienta bien la sartén antes de echar el aceite y la comida se pegará menos. Añade la sal al final, prueba y decide si hace falta más.",
  ],
};
