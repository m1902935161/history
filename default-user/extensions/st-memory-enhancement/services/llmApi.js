import {USER} from '../core/manager.js';
// @ts-ignore
//import { ChatCompletionService } from '/scripts/custom-request.js';
//先注释掉防止无法启动

export class LLMApiService {
    constructor(config = {}) {
        this.config = {
            api_url: config.api_url || "https://api.openai.com/v1",
            api_key: config.api_key || "",
            model_name: config.model_name || "gpt-3.5-turbo",
            system_prompt: config.system_prompt || "You are a helpful assistant.",
            temperature: config.temperature || 1.0,
            max_tokens: config.max_tokens || 4096,
            stream: config.stream || false
        };
    }

    async callLLM(textToTranslate, streamCallback = null) {
        if (!textToTranslate || textToTranslate.trim().length < 2) {
            throw new Error("输入文本太短");
        }

        if (!this.config.api_url || !this.config.api_key || !this.config.model_name) {
            throw new Error("API配置不完整");
        }

        const messages = [
            { role: 'system', content: this.config.system_prompt },
            { role: 'user', content: textToTranslate }
        ];

        this.config.stream = streamCallback !== null;

        // 如果配置了代理地址，则使用 SillyTavern 的内部路由
        if (USER.IMPORTANT_USER_PRIVACY_DATA.table_proxy_address) {
            console.log("检测到代理配置，将使用 SillyTavern 内部路由");
            try {
                const requestData = {
                    stream: this.config.stream,
                    messages: messages,
                    max_tokens: this.config.max_tokens,
                    model: this.config.model_name,
                    temperature: this.config.temperature,
                    chat_completion_source: 'openai', // 假设代理目标是 OpenAI 兼容的
                    custom_url: this.config.api_url,
                    reverse_proxy: USER.IMPORTANT_USER_PRIVACY_DATA.table_proxy_address,
                    proxy_password: USER.IMPORTANT_USER_PRIVACY_DATA.table_proxy_key || null,
                };

                if (this.config.stream) {
                    if (!streamCallback || typeof streamCallback !== 'function') {
                        throw new Error("流式模式下必须提供有效的streamCallback函数");
                    }
                    const streamGenerator = '' //临时注释用
                    //const streamGenerator = await ChatCompletionService.processRequest(requestData, {}, false); // extractData = false for stream
                    let fullResponse = '';
                    for await (const chunk of streamGenerator()) {
                        if (chunk.text) {
                            fullResponse += chunk.text;
                            streamCallback(chunk.text);
                        }
                    }
                    return this.#cleanResponse(fullResponse);
                } else {
                    const responseData = '' //临时注释用
                    //const responseData = await ChatCompletionService.processRequest(requestData, {}, true); // extractData = true for non-stream
                    if (!responseData || !responseData.content) {
                        throw new Error("通过内部路由获取响应失败或响应内容为空");
                    }
                    return this.#cleanResponse(responseData.content);
                }
            } catch (error) {
                console.error("通过 SillyTavern 内部路由调用 LLM API 错误:", error);
                throw error;
            }
        } else {
            // 未配置代理，使用原始的直接 fetch 逻辑
            console.log("未检测到代理配置，将使用直接 fetch");
            let apiEndpoint = this.config.api_url;
            if (!apiEndpoint.endsWith("/chat/completions")) {
                apiEndpoint += "/chat/completions";
            }

            const headers = {
                'Authorization': `Bearer ${this.config.api_key}`,
                'Content-Type': 'application/json'
            };

            const data = {
                model: this.config.model_name,
                messages: messages,
                temperature: this.config.temperature,
                max_tokens: this.config.max_tokens,
                stream: this.config.stream
            };

            try {
                if (this.config.stream) {
                    if (!streamCallback || typeof streamCallback !== 'function') {
                        throw new Error("流式模式下必须提供有效的streamCallback函数");
                    }
                    return await this.#handleStreamResponse(apiEndpoint, headers, data, streamCallback);
                } else {
                    return await this.#handleRegularResponse(apiEndpoint, headers, data);
                }
            } catch (error) {
                console.error("直接调用 LLM API 错误:", error);
                throw error;
            }
        }
    }

    async #handleRegularResponse(apiEndpoint, headers, data) {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API请求失败: ${response.status} - ${errorText}`);
        }

        const responseData = await response.json();

        if (!responseData.choices || responseData.choices.length === 0 ||
            !responseData.choices[0].message || !responseData.choices[0].message.content) {
            throw new Error("API返回无效的响应结构");
        }

        let translatedText = responseData.choices[0].message.content;
        return this.#cleanResponse(translatedText);
    }

    async #handleStreamResponse(apiEndpoint, headers, data, streamCallback) {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API请求失败: ${response.status} - ${errorText}`);
        }

        if (!response.body) {
            throw new Error("无法获取响应流");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let fullResponse = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim() === '') continue;

                    try {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.substring(6).trim();
                            if (dataStr === '[DONE]') continue;

                            const jsonData = JSON.parse(dataStr);
                            if (jsonData.choices?.[0]?.delta?.content) {
                                const content = jsonData.choices[0].delta.content;
                                fullResponse += content;
                                streamCallback(content);
                            }
                        }
                    } catch (e) {
                        console.warn("解析流数据失败:", e, "数据:", line);
                    }
                }
            }

            // 处理缓冲区剩余内容
            if (buffer.trim()) {
                try {
                    const jsonData = JSON.parse(buffer);
                    if (jsonData.choices?.[0]?.delta?.content) {
                        const content = jsonData.choices[0].delta.content;
                        fullResponse += content;
                        streamCallback(content);
                    }
                } catch (e) {
                    console.warn("解析缓冲区数据失败:", e);
                }
            }

            return this.#cleanResponse(fullResponse);
        } finally {
            reader.releaseLock();
        }
    }

    #cleanResponse(text) {
        // 清理响应文本，移除可能的前缀或后缀
        return text.trim();
    }

    async testConnection() {
        const testPrompt = "Say hello.";
        const messages = [
            { role: 'system', content: this.config.system_prompt },
            { role: 'user', content: testPrompt }
        ];

        // 如果配置了代理地址，则使用 SillyTavern 的内部路由进行测试
        if (USER.IMPORTANT_USER_PRIVACY_DATA.table_proxy_address) {
            console.log("检测到代理配置，将使用 SillyTavern 内部路由进行连接测试");
            try {
                const requestData = {
                    stream: false, // 测试连接不需要流式
                    messages: messages,
                    max_tokens: 50, // 测试连接不需要太多 token
                    model: this.config.model_name,
                    temperature: this.config.temperature,
                    chat_completion_source: 'openai', // 假设代理目标是 OpenAI 兼容的
                    custom_url: this.config.api_url,
                    reverse_proxy: USER.IMPORTANT_USER_PRIVACY_DATA.table_proxy_address,
                    proxy_password: USER.IMPORTANT_USER_PRIVACY_DATA.table_proxy_key || null,
                };
                // 使用 processRequest 进行非流式请求测试
                const responseData = '' //临时注释用
                //const responseData = await ChatCompletionService.processRequest(requestData, {}, true);
                if (!responseData || !responseData.content) {
                    throw new Error("通过内部路由测试连接失败或响应内容为空");
                }
                return responseData.content; // 返回响应内容表示成功
            } catch (error) {
                console.error("通过 SillyTavern 内部路由测试 API 连接错误:", error);
                throw error;
            }
        } else {
            // 未配置代理，使用原始的直接 fetch 逻辑进行测试
            console.log("未检测到代理配置，将使用直接 fetch 进行连接测试");
            let apiEndpoint = this.config.api_url;
            if (!apiEndpoint.endsWith("/chat/completions")) {
                apiEndpoint += "/chat/completions";
            }

            const headers = {
                'Authorization': `Bearer ${this.config.api_key}`,
                'Content-Type': 'application/json'
            };

            const data = {
                model: this.config.model_name,
                messages: messages,
                temperature: this.config.temperature,
                max_tokens: 50, // 测试连接不需要太多 token
                stream: false
            };

            try {
                const response = await fetch(apiEndpoint, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(data)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API测试请求失败: ${response.status} - ${errorText}`);
                }

                const responseData = await response.json();
                // 检查响应是否有效
                if (!responseData.choices || responseData.choices.length === 0 || !responseData.choices[0].message || !responseData.choices[0].message.content) {
                    throw new Error("API测试返回无效的响应结构");
                }
                return responseData.choices[0].message.content; // 返回响应内容表示成功
            } catch (error) {
                console.error("直接 fetch 测试 API 连接错误:", error);
                throw error;
            }
        }
    }
}

export default LLMApiService;
