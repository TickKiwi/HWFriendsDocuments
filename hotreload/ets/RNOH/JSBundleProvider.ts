import type resmgr from "@ohos.resourceManager";
import http from '@ohos.net.http';
import util from '@ohos.util';
import urlUtils from '@ohos.url';

export interface HotReloadConfig {
  bundleEntry: string,
  host: string,
  port: number | string,
  scheme?: string,
}

export abstract class JSBundleProvider {
  abstract getURL(): string

  abstract getBundle(): Promise<ArrayBuffer>

  abstract getAppKeys(): string[]

  getHotReloadConfig(): HotReloadConfig | null {
    return null
  }
}

export class JSBundleProviderError extends Error {
  constructor(private msg: string, public originalError: unknown = undefined) {
    super(msg)
  }
}


export class ResourceJSBundleProvider extends JSBundleProvider {
  constructor(private resourceManager: resmgr.ResourceManager, private path: string = "bundle.harmony.js", private appKeys: string[] = []) {
    super()
  }

  getURL() {
    return this.path
  }

  getAppKeys() {
    return this.appKeys
  }

  async getBundle() {
    try {
      const bundleFileContent = await this.resourceManager.getRawFileContent(this.path);
      const bundle = bundleFileContent.buffer;
      return bundle;
    } catch (err) {
      throw new JSBundleProviderError(`Couldn't load JSBundle from ${this.path}`, err)
    }
  }
}


export class MetroJSBundleProvider extends JSBundleProvider {
  static fromServerIp(ip: string, port: number = 8081, appKeys: string[] = []): MetroJSBundleProvider {
    return new MetroJSBundleProvider(`http://${ip}:${port}/index.bundle?platform=harmony&dev=true&minify=false`, appKeys)
  }

  /**
   * If "localhost" doesn't work, try reversed ports forwarding "hdc rport tcp:8081 tcp:8081".
   */
  constructor(private bundleUrl: string = "http://localhost:8081/index.bundle?platform=harmony&dev=true&minify=false", private appKeys: string[] = []) {
    super()
  }

  getAppKeys() {
    return this.appKeys
  }

  getURL() {
    return this.bundleUrl
  }

  getHotReloadConfig(): HotReloadConfig | null {
    const urlObj = urlUtils.URL.parseURL(this.getURL());
    const pathParts = urlObj.pathname.split('/');
    const bundleEntry = pathParts[pathParts.length - 1];
    const port = urlObj.port ?? 8081;
    const scheme = urlObj.protocol.slice(0, -1);

    return {
      bundleEntry,
      host: urlObj.hostname,
      port,
      scheme,
    }
  }

  async getBundleSplit() {
    const httpRequest = http.createHttp();
    let content = '';
    try {
      const rsp = await httpRequest.request(
        this.bundleUrl + '/split-pkgs',
        {
          header: {
            'Content-Type': 'text/javascript'
          },
        }
      );
      for (let i = 0; i < (rsp.result as number); i++) {
        const data = await httpRequest.request(
          this.bundleUrl + '/get-pkg',
          {
            header: {
              'Content-Type': 'text/javascript',
              'pkg': i + '',
            },
          }
        );
        content = content + (data.result as string)
      }
      const encoder = new util.TextEncoder();
      const result = encoder.encodeInto(content);
      return result.buffer;
    } catch (err) {
      throw new JSBundleProviderError(`Couldn't load JSBundle from ${this.bundleUrl}`, err)
    } finally {
      httpRequest.destroy();
    }
  }

  async getBundle(): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const httpRequest = http.createHttp();
      const dataChunks: ArrayBuffer[] = [];

      function cleanUp() {
        httpRequest.destroy();
      }

      httpRequest.on("dataReceive", (chunk) => {
        dataChunks.push(chunk);
      });

      httpRequest.on("dataEnd", () => {
        const totalLength = dataChunks.map(chunk => chunk.byteLength).reduce((acc, length) => acc + length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of dataChunks) {
          const chunkArray = new Uint8Array(chunk);
          result.set(chunkArray, offset);
          offset += chunk.byteLength;
        }
        resolve(result.buffer);
        cleanUp();
      });

      try {
        httpRequest.requestInStream(
          this.bundleUrl,
          {
            header: {
              'Content-Type': 'text/javascript'
            },
          },
          (err, data) => {
            if (err) {
              reject(new JSBundleProviderError(`Couldn't load JSBundle from ${this.bundleUrl}`, err));
              cleanUp();
            }
          }
        );
      } catch (err) {
        reject(new JSBundleProviderError(`Couldn't load JSBundle from ${this.bundleUrl}`, err))
        cleanUp();
      }
    })
  }


  async getBundleSmall() {
    const httpRequest = http.createHttp();
    try {
      const data = await httpRequest.request(
        this.bundleUrl,
        {
          header: {
            'Content-Type': 'text/javascript'
          },
        }
      );
      const encoder = new util.TextEncoder();
      const result = encoder.encodeInto(data.result as string);
      return result.buffer;
    } catch (err) {
      throw new JSBundleProviderError(`Couldn't load JSBundle from ${this.bundleUrl}`, err)
    } finally {
      httpRequest.destroy();
    }
  }
}

export class AnyJSBundleProvider extends JSBundleProvider {
  private pickedJSBundleProvider: JSBundleProvider | undefined = undefined

  constructor(private jsBundleProviders: JSBundleProvider[]) {
    super()
    if (jsBundleProviders.length === 0) {
      throw new JSBundleProviderError("Expected at least 1 JS bundle provider")
    }
  }

  getURL() {
    const jsBundleProvider = this.pickedJSBundleProvider ?? this.jsBundleProviders[0]
    return jsBundleProvider?.getURL() ?? "?"
  }

  getAppKeys() {
    if (!this.pickedJSBundleProvider) {
      return []
    }
    return this.pickedJSBundleProvider.getAppKeys()
  }

  getHotReloadConfig(): HotReloadConfig | null {
    if (this.pickedJSBundleProvider) {
      return this.pickedJSBundleProvider.getHotReloadConfig()
    }
    return null

  }

  async getBundle() {
    const errors: JSBundleProviderError[] = []
    for (const jsBundleProvider of this.jsBundleProviders) {
      try {
        const bundle = await jsBundleProvider.getBundle()
        this.pickedJSBundleProvider = jsBundleProvider;
        return bundle;
      } catch (err) {
        if (err instanceof JSBundleProviderError) {
          errors.push(err)
        }
      }
    }
    throw new JSBundleProviderError("None of the jsBundleProviders was able to load the bundle:", errors)
  }
}