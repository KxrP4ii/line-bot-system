function buildKeywordFlex(keywordData) {
  const hasImage = keywordData.imageUrl && keywordData.imageUrl.trim() !== ""
  const hasButton =
    keywordData.buttonLabel &&
    keywordData.buttonLabel.trim() !== "" &&
    keywordData.buttonUrl &&
    keywordData.buttonUrl.trim() !== ""

  const bubble = {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "text",
          text: `/${keywordData.keyword}`,
          weight: "bold",
          size: "xl",
          color: "#111111"
        },
        {
          type: "text",
          text: keywordData.response,
          wrap: true,
          size: "md",
          color: "#555555"
        }
      ]
    }
  }

  if (hasImage) {
    bubble.hero = {
      type: "image",
      url: keywordData.imageUrl,
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover"
    }
  }

  if (hasButton) {
    bubble.footer = {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          height: "sm",
          action: {
            type: "uri",
            label: keywordData.buttonLabel,
            uri: keywordData.buttonUrl
          }
        }
      ]
    }
  }

  return {
    type: "flex",
    altText: keywordData.response,
    contents: bubble
  }
}

module.exports = { buildKeywordFlex }