import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_shell/main.dart';

void main() {
  testWidgets('App loads smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const FlutterShellApp());
    expect(find.byType(FlutterShellApp), findsOneWidget);
  });
}
