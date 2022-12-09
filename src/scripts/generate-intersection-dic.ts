import axios from "cross-fetch"
import fs from "fs"

const main = async () => {
  const r = await axios("https://cdn.ncaq.net/dic-nico-intersection-pixiv.txt")
  const text = await r.text()
  const map = Object.fromEntries(
    text
      .split("\n")
      .map((x) => x.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .map((s) => {
        const [yomi, word] = s.split("\t")
        return [word, yomi]
      })
  )
  console.log(
    "IntersectionDic: loaded " + Object.keys(map).length + " entries."
  )
  await fs.promises.writeFile(
    "./data/intersection-dic.json",
    JSON.stringify(map)
  )
}
main()
