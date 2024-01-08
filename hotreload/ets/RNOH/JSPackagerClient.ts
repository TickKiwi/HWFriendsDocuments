import webSocket from '@ohos.net.webSocket';
import { RNOHLogger } from './RNOHLogger';
import type { DevToolsController } from "./DevToolsController"
import type { DevMenu } from "./DevMenu"

export interface JSPackagerClientConfig {
  host: string,
  port: number | string,
}

export class JSPackagerClient {
  private webSocket: webSocket.WebSocket;
  private logger: RNOHLogger;

  constructor(logger: RNOHLogger, private devToolsController: DevToolsController, private devMenu: DevMenu) {
    // this.logger = logger.clone("JSPackagerClient");
  }

  public connectToMetroMessages(config: JSPackagerClientConfig) {
    this.webSocket = webSocket.createWebSocket();
    const url = this.buildUrl(config);
    this.webSocket.on("message", (err, data) => {
      if (err) {
        console.log("Websocket error " + err.message);
        return;
      }
      if (typeof data === "string") {
        const message = JSON.parse(data);
        switch (message.method) {
          case "devMenu":
            this.devMenu.show()
            break;
          case "reload":
            this.devToolsController.reload(undefined)
            break;
          default:
            console.log(`Unsupported action: ${message.method}`)
        }
      }
    })
    this.webSocket.connect(url, (err, _data) => {
      if (!err) {
        console.log("Websocket connected successfully");
      } else {
        console.log("Websocket connection failed, err: " + JSON.stringify(err));
      }
    });
  }

  public async onDestroy() {
    /**
     * Closing this websocket creates prevents subsequent loading a bundle from Metro server and connecting this client, when connected using "localhost" url.
     */
    // await this.webSocket?.close();
  }

  private buildUrl(config: JSPackagerClientConfig): string {
    return `ws://${config.host}:${config.port}/message`;
  }
}