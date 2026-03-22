import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_windows/webview_windows.dart' as win;
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';
import 'dart:io';
import 'dart:convert';
import 'package:path_provider/path_provider.dart';
import 'package:open_filex/open_filex.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:share_plus/share_plus.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

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

  final bool _isWindows = Platform.isWindows;

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
      ..addJavaScriptChannel(
        'DownloadChannel',
        onMessageReceived: (JavaScriptMessage message) {
          _handleBase64Download(message.message);
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (int progress) {
            // Update loading bar.
          },
          onPageStarted: (String url) {},
          onPageFinished: (String url) {
            _injectDownloadJS();
          },
          onWebResourceError: (WebResourceError error) {
            debugPrint('WebResourceError: ${error.description}');
            if (error.description.contains('ERR_FILE_NOT_FOUND')) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Preparing file for download...')),
              );
            }
          },
          onNavigationRequest: (NavigationRequest request) {
            debugPrint('Navigation request: ${request.url}');
            if (request.url.startsWith('blob:')) {
              // Blobs are handled by JS injection
              return NavigationDecision.prevent;
            }
            if (_isDownloadLink(request.url)) {
              _launchInExternalBrowser(request.url);
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.url));

    // Handle Android file uploads
    if (Platform.isAndroid) {
      final androidController =
          _mobileController.platform as AndroidWebViewController;
      await androidController.setOnShowFileSelector(_showFileSelector);
    }
  }

  Future<List<String>> _showFileSelector(FileSelectorParams params) async {
    try {
      if (params.acceptTypes.any((type) => type.contains('image'))) {
        final selection = await showModalBottomSheet<String>(
          context: context,
          builder: (BuildContext context) {
            return SafeArea(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ListTile(
                    leading: const Icon(Icons.photo_library),
                    title: const Text('Gallery'),
                    onTap: () => Navigator.pop(context, 'gallery'),
                  ),
                  ListTile(
                    leading: const Icon(Icons.camera_alt),
                    title: const Text('Camera'),
                    onTap: () => Navigator.pop(context, 'camera'),
                  ),
                  ListTile(
                    leading: const Icon(Icons.insert_drive_file),
                    title: const Text('Files'),
                    onTap: () => Navigator.pop(context, 'files'),
                  ),
                ],
              ),
            );
          },
        );

        if (selection == 'gallery') {
          final XFile? photo =
              await ImagePicker().pickImage(source: ImageSource.gallery);
          return photo != null ? [Uri.file(photo.path).toString()] : [];
        } else if (selection == 'camera') {
          final XFile? photo =
              await ImagePicker().pickImage(source: ImageSource.camera);
          return photo != null ? [Uri.file(photo.path).toString()] : [];
        } else if (selection == 'files') {
          FilePickerResult? result = await FilePicker.platform.pickFiles();
          return result != null && result.files.single.path != null
              ? [Uri.file(result.files.single.path!).toString()]
              : [];
        }
      } else {
        FilePickerResult? result = await FilePicker.platform.pickFiles();
        return result != null && result.files.single.path != null
            ? [Uri.file(result.files.single.path!).toString()]
            : [];
      }
    } catch (e) {
      debugPrint('Error picking file: $e');
    }
    return [];
  }

  void _injectDownloadJS() {
    const js = """
      (function() {
        // Override URL.createObjectURL to capture blob URLs
        const originalCreateObjectURL = URL.createObjectURL;
        URL.createObjectURL = function(blob) {
          const url = originalCreateObjectURL(blob);
          if (blob instanceof Blob) {
            const reader = new FileReader();
            reader.onload = function() {
              const base64data = reader.result;
              const fileName = blob.name || 'downloaded_file';
              const mimeType = blob.type || 'application/octet-stream';
              DownloadChannel.postMessage(JSON.stringify({
                data: base64data,
                name: fileName,
                mime: mimeType
              }));
            };
            reader.readAsDataURL(blob);
          }
          return url;
        };

        // Intercept anchor clicks for blob/data URLs
        document.addEventListener('click', function(e) {
          const target = e.target.closest('a');
          if (target && target.href) {
            const href = target.href;
            if (href.startsWith('blob:') || href.startsWith('data:')) {
              // If it's a data URL, we can send it directly
              if (href.startsWith('data:')) {
                DownloadChannel.postMessage(JSON.stringify({
                  data: href,
                  name: target.download || 'download',
                  mime: ''
                }));
                e.preventDefault();
              }
            }
          }
        }, true);
      })();
    """;
    _mobileController.runJavaScript(js);
  }

  Future<void> _handleBase64Download(String message) async {
    try {
      final decoded = jsonDecode(message);
      final String dataUrl = decoded['data'];
      final String fileName = decoded['name'] ?? 'download';
      
      // Extract base64 part
      final String base64Content = dataUrl.contains(',') 
          ? dataUrl.split(',')[1] 
          : dataUrl;
      
      final bytes = base64Decode(base64Content);
      final directory = await getApplicationDocumentsDirectory();
      
      // Ensure specific extension if missing
      String finalName = fileName;
      if (!finalName.contains('.')) {
        final mime = decoded['mime'] ?? '';
        if (mime == 'application/pdf') {
          finalName += '.pdf';
        } else if (mime == 'image/png') {
          finalName += '.png';
        } else if (mime == 'image/jpeg') {
          finalName += '.jpg';
        }
      }

      final file = File('${directory.path}/$finalName');
      await file.writeAsBytes(bytes);

      if (!mounted) {
        return;
      }

      // Use Share to let the user save it to their preferred location (e.g., Downloads, Drive, etc.)
      await Share.shareXFiles([XFile(file.path)], text: 'Downloaded $finalName');

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Downloaded: $finalName'),
          action: SnackBarAction(
            label: 'Open',
            onPressed: () => OpenFilex.open(file.path),
          ),
        ),
      );
    } catch (e) {
      debugPrint('Error handling download: $e');
    }
  }

  bool _isDownloadLink(String url) {
    final lowerUrl = url.toLowerCase();
    final downloadExtensions = [
      '.apk', '.pdf', '.zip', '.rar', '.exe', '.dmg', '.bin', '.pkg', '.deb',
      '.xlsx', '.xls', '.csv', '.docx', '.doc', '.pptx', '.ppt', '.txt',
      '.msi', '.7z', '.tar', '.gz', '.png', '.jpg', '.jpeg', '.gif'
    ];
    
    if (downloadExtensions.any((ext) => lowerUrl.endsWith(ext) || lowerUrl.contains('$ext?'))) {
      return true;
    }
    
    final downloadKeywords = [
      'download', 'export', 'attachment', 'file_id=', 'get_file', 'download_true', 'download=1'
    ];
    
    return downloadKeywords.any((keyword) => lowerUrl.contains(keyword));
  }

  Future<void> _launchInExternalBrowser(String url) async {
    final uri = Uri.parse(url);
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
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
