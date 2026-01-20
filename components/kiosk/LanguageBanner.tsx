const LanguageBanner = () => {
  const languages = [
    "Talk to me in your familiar language",
    "用你熟悉的语言和我对话",
    "用你熟悉的語言跟我對話",
    "あなたが話しやすい言葉で話してください",
    "당신이 편한 언어로 대화하세요",
    "Parlez-moi dans votre langue familière",
    "Háblame en tu idioma familiar",
    "अपनी परिचित भाषा में मुझसे बात करें",
    "Talk to me in your familiar language",
    "Sprechen Sie mit mir in Ihrer vertrauten Sprache",
    "Fale comigo no seu idioma familiar",
    "Говорите со мной на знакомом вам языке",
    "Nói chuyện với tôi bằng ngôn ngữ quen thuộc của bạn",
    "Parlami nella tua lingua familiare",
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 text-gray-800 py-1 overflow-hidden z-10 shadow-lg">
      <div className="relative flex overflow-hidden">
        {/* First set of scrolling text */}
        <div className="flex animate-scroll whitespace-nowrap">
          {languages.map((text, index) => (
            <span
              key={`first-${index}`}
              className="mx-8 text-lg font-semibold inline-block"
            >
              {text}
            </span>
          ))}
        </div>
        {/* Duplicate set for seamless loop */}
        <div className="flex animate-scroll whitespace-nowrap" aria-hidden="true">
          {languages.map((text, index) => (
            <span
              key={`second-${index}`}
              className="mx-8 text-lg font-semibold inline-block"
            >
              {text}
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-100%);
          }
        }

        .animate-scroll {
          animation: scroll 60s linear infinite;
        }

        /* Pause animation on hover */
        .animate-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
};

export default LanguageBanner;

