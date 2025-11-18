import type { NextApiRequest, NextApiResponse } from "next";
import { WebSocketServer } from "ws";
import { Mistral } from "@mistralai/mistralai";
import Kernel from "@onkernel/sdk";
import { getDesktop, killDesktop } from "@/lib/e2b/utils";
import { resolution } from "@/lib/e2b/tool";

const MISTRAL_API_KEY = "6kC3YYU0fstrvm9WCQudLOKEK53DhvNU";
const MISTRAL_MODEL = "mistral-medium-2508";
const ONKERNEL_API_KEY = "sk_85dd38ea-b33f-45b5-bc33-0eed2357683a.t2lQgq3Lb6DamEGhcLiUgPa1jlx+1zD4BwAdchRHYgA";
const kernelClient = new Kernel({ apiKey: ONKERNEL_API_KEY });

const tools = [
  {
    type: "function",
    function: {
      name: "computer_use",
      description: "Use a mouse and keyboard to interact with a computer, and take screenshots.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: [
              "screenshot",
              "left_click",
              "double_click",
              "right_click",
              "mouse_move",
              "type",
              "key",
              "scroll",
              "left_click_drag",
              "wait",
            ],
            description: "The action to perform.",
          },
          coordinate: {
            type: "array",
            items: { type: "integer" },
            minItems: 2,
            maxItems: 2,
            description: "[X, Y] coordinates for mouse actions. X is horizontal (0-1023), Y is vertical (0-767).",
          },
          start_coordinate: {
            type: "array",
            items: { type: "integer" },
            minItems: 2,
            maxItems: 2,
            description: "Starting [X, Y] coordinates for drag action.",
          },
          text: {
            type: "string",
            description: "Text to type or key to press.",
          },
          delta_x: {
            type: "integer",
            description: "Horizontal scroll delta (default: 0).",
          },
          delta_y: {
            type: "integer",
            description: "Vertical scroll delta. Positive values scroll down, negative values scroll up.",
          },
          duration: {
            type: "integer",
            description: "Duration to wait in seconds (max 2).",
          },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bash_command",
      description: "Execute a bash command in the Linux terminal.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The bash command to execute.",
          },
        },
        required: ["command"],
      },
    },
  },
];

type StreamPayload = {
  type: "chat";
  messages: any[];
  sandboxId?: string | null;
};

type SendFn = (payload: Record<string, any>) => void;

type ActiveStream = {
  sandboxId?: string | null;
  closed: boolean;
};

async function handleChat({ payload, send, stream }: { payload: StreamPayload; send: SendFn; stream: ActiveStream }) {
  const { messages, sandboxId } = payload;
  const desktop = await getDesktop(sandboxId || undefined);
  stream.sandboxId = desktop.session_id;

  const mistral = new Mistral({ apiKey: MISTRAL_API_KEY });  let isStreamClosed = false;

  const sendEvent = (event: any) => {
    if (isStreamClosed || stream.closed) return;
    try {
      send(event);
    } catch (error) {
      console.error("[WS SEND ERROR]", error);
    }
  };

  try {
    const chatHistory: any[] = [
      {
        role: "system",
        content: `- Nazywasz się Mistral i Jesteś Operatorem - zaawansowanym asystentem AI, który może bezpośrednio kontrolować komputer, aby wykonywać zadania użytkownika. Twoja rola to **proaktywne działanie** z pełną transparentnością. Zawsze Pisz w stylu bardziej osobistym i narracyjnym. Zamiast suchych i technicznych opisów, prowadź użytkownika przez działania w sposób ciepły, ludzki, opowiadający historię. Zwracaj się bezpośrednio do użytkownika, a nie jak robot wykonujący instrukcje. Twórz atmosferę towarzyszenia, a nie tylko raportowania. Mów w czasie teraźniejszym i używaj przyjaznych sformułowań. Twój styl ma być płynny, naturalny i przyjazny. Unikaj powtarzania wyrażeń technicznych i suchych komunikatów — jeśli musisz podać lokalizację kursora lub elementu, ubierz to w narrację.

WAŻNE!!!!: ZAWSZE ZACZYNAJ KAZDEGO TASKA OD WYSLANIA WIADOMOSCI TEKSTOWEJ A PO WYSLANIU WIADOMOSCI TEKSTOWEJ MUSISZ ZROBIC PIERWSZY ZRZUT EKRANU BY SPRAWDZIC STAN DESKTOPA WAZNE!!! KAZDE ZADSNIE MUSISZ ZACZYNAC OD NAPISANIA WIADOMOSCI DOPIERO GDY NAPISZESZ WIADOMOSC MOZESZ WYKONAC PIERWSZY ZURZUT EKRANU

WAZNE!!!!: ZAWSZE ODCZEKAJ CHWILE PO KLIKNIECIU BY DAC CZAS NA ZALADOWANIE SIE

🚨 ABSOLUTNIE KRYTYCZNE - ANALIZA SCREENSHOTÓW 🚨
WAZNE!!!!: PO KAŻDYM SCREENSHOCIE MUSISZ:
1. ZATRZYMAĆ SIĘ i SZCZEGÓŁOWO PRZEANALIZOWAĆ screenshot
2. OPISAĆ w wiadomości tekstowej CO DOKŁADNIE WIDZISZ na screenshocie (okna, przyciski, teksty, ikony, pozycje elementów)
3. OKREŚLIĆ dokładne współrzędne elementów, które widzisz
4. DOPIERO PO PEŁNEJ ANALIZIE możesz wykonać kolejną akcję
5. NIE WOLNO CI natychmiast wykonywać kolejnych akcji bez wysłania analizy screenshota!

ZAKAZ: Robienie screenshota i natychmiastowe wykonywanie akcji bez analizy
WYMAGANE: Screenshot → Analiza w wiadomości tekstowej → Dopiero akcja

WAZNE!!!!: NIGDY NIE ZGADUJ WSPOLRZEDNYCH JEST TO BEZWZGLEDNIE ZAKAZANE

ZAPAMIETAJ!!!WAŻNE!!!:  Rozdzielczość desktop (Resolution): 1024 x 768 pikseli skala: 100%, format: 4 x 3 system: ubuntu 22.04 Oto współrzędne skrajnych punktów sandboxa (rozdzielczość: 1024 × 768 pikseli):

📐 Skrajne punkty sandboxa:
Format współrzędnych: [X, Y]

Podstawowe punkty:
Lewy górny róg: [0, 0]
Prawy górny róg: [1023, 0]
Lewy dolny róg: [0, 767]
Prawy dolny róg: [1023, 767]
Środek ekranu: [512, 384]
Skrajne granice:
Góra: Y = 0 (cały górny brzeg)
Dół: Y = 767 (cały dolny brzeg)
Lewo: X = 0 (cała lewa krawędź)
Prawo: X = 1023 (cała prawa krawędź)
Zakresy:
X (poziomo): 0 → 1023 (lewo → prawo)
Y (pionowo): 0 → 767 (góra → dół)
Ważne: Y = 0 to GÓRA ekranu, a Y = 767 to DÓŁ. Współrzędne zawsze podawane w formacie [X, Y] - najpierw poziomo, potem pionowo.

WAŻNE!!!!: MUSISZ BARDZO CZESTO ROBIC ZRZUTY EKRANU BY SPRAWDZAC STAN SANDBOXA - NAJLEPIEJ CO AKCJE!!! ZAWSZE PO KAZDEJ AKCJI ROB ZRZUT EKRANU MUSISZ KONTROLOWAC STAN SANDBOXA

WAŻNE!!!!: ZAWSZE ZACZYNAJ KAZDEGO TASKA OD WYSLANIA WIADOMOSCI A PO WYSLANIU WIADOMOSCI MUSISZ ZROBIC PIERWSZY ZRZUT EKRANU BY SPRAWDZIC STAN DESKTOPA WAZNE!!! KAZDE ZADSNIE MUSISZ ZACZYNAC OD NAPISANIA WIADOMOSCI DOPIERO GDY NAPISZESZ WIADOMOSC MOZESZ WYKONAC PIERWSZY ZURZUT EKRANU

WAŻNE!!!!: PRZEGLADARKA ZNAJDUJE SIE POD IKONA GLOBU

✳️ STYL I OSOBOWOŚĆ:

Pisz w stylu narracyjnym, osobistym i ciepłym. Zamiast technicznego raportowania, prowadź użytkownika w formie naturalnej rozmowy.
Twoja osobowość jako AI to:

Pozytywna, entuzjastyczna, pomocna, wspierająca, ciekawska, uprzejma i zaangażowana.
Masz w sobie życzliwość i lekkość, ale jesteś też uważna i skupiona na zadaniu.
Dajesz użytkownikowi poczucie bezpieczeństwa i komfortu — jak przyjaciel, który dobrze się zna na komputerach i z uśmiechem pokazuje, co robi.

Używaj przyjaznych sformułowań i naturalnego języka. Zamiast mówić jak automat („Kliknę w ikonę", „320,80"), mów jak osoba („Zaraz kliknę pasek adresu, żebyśmy mogli coś wpisać").
Twój język ma być miękki, a narracja – płynna, oparta na teraźniejszości, swobodna.
Unikaj powtarzania „klikam", „widzę", „teraz zrobię" — wplataj to w opowieść, nie raport.

Absolutnie nigdy nie pisz tylko czysto techniczno, robotycznie - zawsze opowiadaj aktywnie uzytkownikowi, mow cos do uzytkownika, opisuj mu co bedziesz robic, opowiadaj nigdy nie mow czysto robotycznie prowadz tez rozmowe z uzytknownikiem i nie pisz tylko na temat tego co wyjonujesz ale prowadz rowniez aktywna i zaangazowana konwersacje, opowiafaj tez cos uzytkownikowi

WAŻNE: JEŚLI WIDZISZ CZARNY EKRAN ZAWSZE ODCZEKAJ CHWILE AZ SIE DESKTOP ZANIM RUSZYSZ DALEJ - NIE MOZESZ BEZ TEGO ZACZAC TASKA

WAŻNE ZAWSZE CHWILE ODCZEKAJ PO WYKONANIU AKCJI`,
      },
      ...messages,
    ];

    const maxIterations = 100;
    let iteration = 0;

    while (!isStreamClosed && iteration < maxIterations) {
      iteration++;

      const response = await mistral.chat.stream({
        model: MISTRAL_MODEL,
        messages: chatHistory,
        tools: tools as any,
        temperature: 0.3,
        maxTokens: 4096,
      });

      let fullText = "";
      let toolCalls: any[] = [];

      for await (const event of response) {
        if (!event.data.choices || event.data.choices.length === 0) continue;
        const choice = event.data.choices[0];
        const delta = choice.delta;

        if (delta.content) {
          fullText += delta.content;
          sendEvent({ type: "text-delta", textDelta: delta.content });
        }

        if (delta.toolCalls) {
          for (const toolCallDelta of delta.toolCalls) {
            const index = toolCallDelta.index;

            if (index !== undefined && !toolCalls[index]) {
              toolCalls[index] = {
                id: toolCallDelta.id || `call_${Date.now()}_${index}`,
                name: toolCallDelta.function?.name || "",
                arguments: "",
              };
            }

            if (index !== undefined && toolCallDelta.function?.arguments) {
              toolCalls[index].arguments += toolCallDelta.function.arguments;
            }
          }
        }
      }

      if (toolCalls.length > 0) {
        const firstToolCall = toolCalls[0];
        const assistantMessage: any = {
          role: "assistant",
          content: fullText || null,
          toolCalls: [
            {
              id: firstToolCall.id,
              type: "function",
              function: {
                name: firstToolCall.name,
                arguments: firstToolCall.arguments,
              },
            },
          ],
        };
        chatHistory.push(assistantMessage);

        const toolCall = firstToolCall;
        const parsedArgs = JSON.parse(toolCall.arguments);
        const toolName = toolCall.name === "computer_use" ? "computer" : "bash";

        sendEvent({
          type: "tool-input-available",
          toolCallId: toolCall.id,
          toolName: toolName,
          input: parsedArgs,
        });

        const toolResult = await (async () => {
          let resultData: any = { type: "text", text: "" };
          let resultText = "";

          if (toolCall.name === "computer_use") {
            const action = parsedArgs.action;

            switch (action) {
              case "screenshot": {
                const response = await kernelClient.browsers.computer.captureScreenshot(desktop.session_id);
                const blob = await response.blob();
                const buffer = Buffer.from(await blob.arrayBuffer());

                const timestamp = new Date().toISOString();
                const width = resolution.x;
                const height = resolution.y;

                resultText = `Screenshot taken at ${timestamp}

SCREEN: ${width}×${height} pixels | Aspect ratio: 4:3 | Origin: (0,0) at TOP-LEFT
⚠️  REMEMBER: Y=0 is at TOP, Y increases DOWNWARD (0→767)
⚠️  FORMAT: [X, Y] - horizontal first, then vertical
⚠️  SZCZEGÓŁOWA ANALIZA WYMAGANA: Przeanalizuj dokładnie screenshot przed kolejnymi akcjami!`;

                resultData = {
                  type: "image",
                  data: buffer.toString("base64"),
                };

                sendEvent({
                  type: "screenshot-update",
                  screenshot: buffer.toString("base64"),
                });
                break;
              }
              case "wait": {
                const duration = parsedArgs.duration || 1;
                resultText = `Waited for ${duration} seconds`;
                resultData = { type: "text", text: resultText };
                break;
              }
              case "left_click": {
                const [x, y] = parsedArgs.coordinate;
                await kernelClient.browsers.computer.clickMouse(desktop.session_id, {
                  x,
                  y,
                  button: "left",
                });
                resultText = `Left clicked at coordinates (${x}, ${y})`;
                resultData = { type: "text", text: resultText };
                break;
              }
              case "double_click": {
                const [x, y] = parsedArgs.coordinate;
                await kernelClient.browsers.computer.clickMouse(desktop.session_id, {
                  x,
                  y,
                  button: "left",
                  num_clicks: 2,
                });
                resultText = `Double clicked at coordinates (${x}, ${y})`;
                resultData = { type: "text", text: resultText };
                break;
              }
              case "right_click": {
                const [x, y] = parsedArgs.coordinate;
                await kernelClient.browsers.computer.clickMouse(desktop.session_id, {
                  x,
                  y,
                  button: "right",
                });
                resultText = `Right clicked at coordinates (${x}, ${y})`;
                resultData = { type: "text", text: resultText };
                break;
              }
              case "mouse_move": {
                const [x, y] = parsedArgs.coordinate;
                await kernelClient.browsers.computer.moveMouse(desktop.session_id, { x, y });
                resultText = `Moved mouse to ${x}, ${y}`;
                resultData = { type: "text", text: resultText };
                break;
              }
              case "type": {
                const textToType = parsedArgs.text;
                await kernelClient.browsers.computer.typeText(desktop.session_id, { text: textToType });
                resultText = `Typed: ${textToType}`;
                resultData = { type: "text", text: resultText };
                break;
              }
              case "key": {
                let keyToPress = parsedArgs.text;

                const keyMap: Record<string, string> = {
                  enter: "Return",
                  tab: "Tab",
                  backspace: "BackSpace",
                  escape: "Escape",
                  esc: "Escape",
                  space: "space",
                  up: "Up",
                  down: "Down",
                  left: "Left",
                  right: "Right",
                };

                const normalizedKey = keyToPress.toLowerCase();
                keyToPress = keyMap[normalizedKey] || keyToPress;

                await kernelClient.browsers.computer.typeKey(desktop.session_id, { key: keyToPress });
                resultText = `Pressed key: ${keyToPress}`;
                resultData = { type: "text", text: resultText };
                break;
              }
              case "scroll": {
                const { delta_x = 0, delta_y = 0 } = parsedArgs;
                await kernelClient.browsers.computer.scroll(desktop.session_id, {
                  delta_x,
                  delta_y,
                });
                resultText = `Scrolled by delta (${delta_x}, ${delta_y})`;
                resultData = { type: "text", text: resultText };
                break;
              }
              case "left_click_drag": {
                const [x, y] = parsedArgs.coordinate;
                const [toX, toY] = parsedArgs.to_coordinate;
                await kernelClient.browsers.computer.dragMouse(desktop.session_id, {
                  from: { x, y },
                  to: { x: toX, y: toY },
                });
                resultText = `Dragged mouse from (${x}, ${y}) to (${toX}, ${toY})`;
                resultData = { type: "text", text: resultText };
                break;
              }
              default: {
                resultText = `Unknown action: ${action}`;
                resultData = { type: "text", text: resultText };
                break;
              }
            }
          } else if (toolCall.name === "bash_command") {
            const result = await kernelClient.browsers.process.exec(desktop.session_id, {
              command: parsedArgs.command,
            });

            const stdout = result.stdout_b64 ? Buffer.from(result.stdout_b64, "base64").toString("utf-8") : "";
            const stderr = result.stderr_b64 ? Buffer.from(result.stderr_b64, "base64").toString("utf-8") : "";
            const output = stdout || stderr || "(Command executed successfully with no output)";

            sendEvent({
              type: "tool-output-available",
              toolCallId: toolCall.id,
              output: { type: "text", text: output },
            });

            return {
              tool_call_id: toolCall.id,
              role: "tool",
              content: output,
            };
          }

          return {
            tool_call_id: toolCall.id,
            role: "tool",
            content: resultText,
            image: resultData.type === "image" ? resultData.data : undefined,
          };
        })();

        if (toolResult!.image) {
          chatHistory.push({
            role: "tool",
            toolCallId: toolResult!.tool_call_id,
            content: [
              { type: "text", text: toolResult!.content },
              { type: "image_url", imageUrl: `data:image/png;base64,${toolResult!.image}` },
            ],
          });
        } else {
          chatHistory.push({
            role: "tool",
            toolCallId: toolResult!.tool_call_id,
            content: toolResult!.content,
          });
        }
      } else {
        if (fullText) {
          chatHistory.push({ role: "assistant", content: fullText });
        }

        sendEvent({ type: "finish", content: fullText });
        break;
      }
    }
  } catch (error) {
    console.error("Chat WS error:", error);
    await killDesktop(stream.sandboxId || sandboxId || "");
    sendEvent({ type: "error", errorText: String(error) });
  } finally {
    isStreamClosed = true;
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.upgrade !== "websocket") {
    res.status(426).json({ error: "Expected WebSocket upgrade" });
    return;
  }

  if (!(res.socket as any).server.wss) {
    const wss = new WebSocketServer({ server: (res.socket as any).server });
    (res.socket as any).server.wss = wss;

    wss.on("connection", (ws) => {
      const streamState: ActiveStream = { closed: false };

      const send: SendFn = (payload) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify(payload));
        }
      };

      ws.on("message", async (message) => {
        let parsed: any;
        try {
          parsed = JSON.parse(message.toString());
        } catch (error) {
          console.error("[WS PARSE ERROR]", error);
          return;
        }

        if (parsed.type === "chat") {
          await handleChat({ payload: parsed as StreamPayload, send, stream: streamState });
        }
      });

      ws.on("close", async () => {
        streamState.closed = true;
        if (streamState.sandboxId) {
          await killDesktop(streamState.sandboxId);
        }
      });

      ws.on("error", (err) => {
        console.error("[WS ERROR]", err);
      });
    });
  }

  res.end();
}
