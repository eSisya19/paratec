import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_windows/webview_windows.dart' as win;
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';
import 'dart:io';

void main() {
  runApp(const FlutterShellApp());
}

class FlutterShellApp extends StatelessWidget {
  const FlutterShellApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ParasJC',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home: const ShellLoader(),
    );
  }
}

class ShellLoader extends StatefulWidget {
  const ShellLoader({super.key});

  @override
  State<ShellLoader> createState() => _ShellLoaderState();
}

class _ShellLoaderState extends State<ShellLoader> {
  String? targetUrl;
  String? error;
  bool isLoading = true;

  static const String githubConfigUrl =
      'https://raw.githubusercontent.com/eSisya19/paratec/refs/heads/main/config.txt';

  @override
  void initState() {
    super.initState();
    _fetchUrl();
  }

  Future<void> _fetchUrl() async {
    try {
      final response = await http.get(Uri.parse(githubConfigUrl));
      if (response.statusCode == 200) {
        final url = response.body.trim();
        if (Uri.tryParse(url)?.hasAbsolutePath ?? false) {
          setState(() {
            targetUrl = url;
            isLoading = false;
          });
        } else {
          setState(() {
            error = 'Invalid URL found in config: $url';
            isLoading = false;
          });
        }
      } else {
        setState(() {
          error = 'Failed to load config: ${response.statusCode}';
          isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        error = 'Error fetching config: $e';
        isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (error != null) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, color: Colors.red, size: 60),
                const SizedBox(height: 16),
                Text(error!, textAlign: TextAlign.center),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () {
                    setState(() {
                      isLoading = true;
                      error = null;
                    });
                    _fetchUrl();
                  },
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return ShellWebView(url: targetUrl!);
  }
}

class ShellWebView extends StatefulWidget {
  final String url;
  const ShellWebView({super.key, required this.url});

  @override
  State<ShellWebView> createState() => _ShellWebViewState();
}

class _ShellWebViewState extends State<ShellWebView> {
  // Mobile/macOS WebView Controller
  late final WebViewController _mobileController;
  // Windows WebView Controller
  final win.WebviewController _winController = win.WebviewController();

  bool _isWindows = Platform.isWindows;

  @override
  void initState() {
    super.initState();
    if (_isWindows) {
      _initWindows();
    } else {
      _initMobile();
    }
  }

  Future<void> _initMobile() async {
    _mobileController = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (int progress) {
            // Update loading bar.
          },
          onPageStarted: (String url) {},
          onPageFinished: (String url) {},
          onWebResourceError: (WebResourceError error) {},
          onNavigationRequest: (NavigationRequest request) {
            debugPrint('Navigation request to: ${request.url}');
            // For Android, if it looks like a download or common external link,
            // we force it to open in the system browser.
            if (_isDownloadLink(request.url)) {
              _launchInExternalBrowser(request.url);
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.url));
  }

  bool _isDownloadLink(String url) {
    final lowerUrl = url.toLowerCase();
    
    // Comprehensive list of download extensions
    final downloadExtensions = [
      '.apk', '.pdf', '.zip', '.rar', '.exe', '.dmg', '.bin', '.pkg', '.deb',
      '.xlsx', '.xls', '.csv', '.docx', '.doc', '.pptx', '.ppt', '.txt',
      '.msi', '.7z', '.tar', '.gz',
    ];
    
    bool hasExtension = downloadExtensions.any((ext) => lowerUrl.contains(ext));
    
    // Keyword detection for dynamic buttons/links that don't have extensions in the URL
    final downloadKeywords = [
      'download',
      'export',
      'attachment',
      'file_id=',
      'get_file',
      'download_true',
    ];
    
    bool hasKeyword = downloadKeywords.any((keyword) => lowerUrl.contains(keyword));
    
    return hasExtension || hasKeyword;
  }

  Future<void> _launchInExternalBrowser(String url) async {
    final uri = Uri.parse(url);
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        debugPrint('Could not launch $url');
      }
    } catch (e) {
      debugPrint('Error launching URL: $e');
    }
  }

  Future<void> _initWindows() async {
    await _winController.initialize();
    await _winController.loadUrl(widget.url);
    if (!mounted) return;
    setState(() {});
  }

  @override
  void dispose() {
    if (_isWindows) {
      _winController.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: _isWindows
            ? _winController.value.isInitialized
                ? win.Webview(_winController)
                : const Center(child: CircularProgressIndicator())
            : WebViewWidget(controller: _mobileController),
      ),
    );
  }
}
