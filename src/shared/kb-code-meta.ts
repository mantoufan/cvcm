import { CODE_ARTICLES, CODE_TOOLS, type CodeId } from "./kb-code";
import { registerCodeShelf, type KbMeta } from "./kb";
import { CODE_MINUTES, CODE_UPDATED } from "../locales/kb/meta-code";

/**
 * Sources, links and dates of the coding articles. Only kb pages need them, so this module rides in the kb packs
 * (src/locales/packs/kb-*.ts) and registers itself with kb.ts instead of sitting in the entry chunk.
 */
const D = "2026-10-31";

const META: Record<CodeId, Omit<KbMeta, "tools">> = {
  "python": {
    published: D,
    tutorials: ["test-regex"],
    related: ["javascript", "ruby", "go"],
    sources: [
      { title: "Python documentation: The Python Tutorial", href: "https://docs.python.org/3/tutorial/" },
      { title: "The Python Standard Library", href: "https://docs.python.org/3/library/" },
    ],
  },
  "javascript": {
    published: D,
    tutorials: ["format-json"],
    related: ["typescript", "python", "php"],
    sources: [
      { title: "MDN Web Docs: JavaScript Guide", href: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide" },
      { title: "Node.js: Learn", href: "https://nodejs.org/en/learn" },
      { title: "ECMAScript Language Specification (Ecma-262)", href: "https://tc39.es/ecma262/" },
    ],
  },
  "typescript": {
    published: D,
    tutorials: [],
    related: ["javascript", "csharp", "design-patterns"],
    sources: [
      { title: "The TypeScript Handbook", href: "https://www.typescriptlang.org/docs/handbook/intro.html" },
      { title: "TypeScript Playground", href: "https://www.typescriptlang.org/play" },
    ],
  },
  "java": {
    published: D,
    tutorials: [],
    related: ["kotlin", "csharp", "scala", "design-patterns"],
    sources: [
      { title: "dev.java: Learn Java", href: "https://dev.java/learn/" },
      { title: "Oracle: The Java Tutorials", href: "https://docs.oracle.com/javase/tutorial/" },
      { title: "Java SE 21 API documentation", href: "https://docs.oracle.com/en/java/javase/21/docs/api/index.html" },
    ],
  },
  "c": {
    published: D,
    tutorials: ["convert-base"],
    related: ["cpp", "rust", "assembly", "zig"],
    sources: [
      { title: "cppreference.com: C reference", href: "https://en.cppreference.com/w/c" },
      { title: "ISO/IEC JTC1/SC22/WG14 (C standard committee)", href: "https://www.open-std.org/jtc1/sc22/wg14/" },
    ],
  },
  "cpp": {
    published: D,
    tutorials: [],
    related: ["c", "rust", "csharp", "design-patterns"],
    sources: [
      { title: "cppreference.com: C++ reference", href: "https://en.cppreference.com/w/cpp" },
      { title: "Standard C++ Foundation: Get Started", href: "https://isocpp.org/get-started" },
      { title: "C++ Core Guidelines", href: "https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines" },
    ],
  },
  "csharp": {
    published: D,
    tutorials: ["generate-uuid"],
    related: ["java", "typescript", "fsharp", "cpp"],
    sources: [
      { title: "Microsoft Learn: C# documentation", href: "https://learn.microsoft.com/en-us/dotnet/csharp/" },
      { title: "Microsoft Learn: A tour of the C# language", href: "https://learn.microsoft.com/en-us/dotnet/csharp/tour-of-csharp/" },
    ],
  },
  "go": {
    published: D,
    tutorials: [],
    related: ["rust", "python", "c"],
    sources: [
      { title: "A Tour of Go", href: "https://go.dev/tour/" },
      { title: "Effective Go", href: "https://go.dev/doc/effective_go" },
      { title: "The Go Programming Language Specification", href: "https://go.dev/ref/spec" },
    ],
  },
  "rust": {
    published: D,
    tutorials: [],
    related: ["cpp", "go", "c", "zig"],
    sources: [
      { title: "The Rust Programming Language (the book)", href: "https://doc.rust-lang.org/book/" },
      { title: "Rust by Example", href: "https://doc.rust-lang.org/rust-by-example/" },
      { title: "The Rust Standard Library", href: "https://doc.rust-lang.org/std/" },
    ],
  },
  "php": {
    published: D,
    tutorials: ["encode-url"],
    related: ["javascript", "python", "ruby", "sql"],
    sources: [
      { title: "PHP Manual", href: "https://www.php.net/manual/en/" },
      { title: "PHP Manual: Language Reference", href: "https://www.php.net/manual/en/langref.php" },
    ],
  },
  "ruby": {
    published: D,
    tutorials: ["test-regex"],
    related: ["python", "php", "elixir"],
    sources: [
      { title: "Ruby documentation (ruby-lang.org)", href: "https://www.ruby-lang.org/en/documentation/" },
      { title: "Ruby in Twenty Minutes", href: "https://www.ruby-lang.org/en/documentation/quickstart/" },
      { title: "Ruby core and standard library reference", href: "https://docs.ruby-lang.org/en/" },
    ],
  },
  "swift": {
    published: D,
    tutorials: [],
    related: ["objective-c", "kotlin", "rust", "dart"],
    sources: [
      { title: "The Swift Programming Language", href: "https://docs.swift.org/swift-book/" },
      { title: "Swift.org documentation", href: "https://www.swift.org/documentation/" },
    ],
  },
  "kotlin": {
    published: D,
    tutorials: [],
    related: ["java", "swift", "scala", "dart"],
    sources: [
      { title: "Kotlin documentation", href: "https://kotlinlang.org/docs/home.html" },
      { title: "Kotlin documentation: Basic syntax", href: "https://kotlinlang.org/docs/basic-syntax.html" },
    ],
  },
  "dart": {
    published: D,
    tutorials: [],
    related: ["kotlin", "swift", "javascript", "typescript"],
    sources: [
      { title: "Dart documentation: Introduction to Dart", href: "https://dart.dev/language" },
      { title: "Dart tutorials", href: "https://dart.dev/tutorials" },
    ],
  },
  "scala": {
    published: D,
    tutorials: [],
    related: ["kotlin", "java", "haskell", "fsharp"],
    sources: [
      { title: "Scala 3 Book", href: "https://docs.scala-lang.org/scala3/book/introduction.html" },
      { title: "Scala documentation", href: "https://docs.scala-lang.org/" },
    ],
  },
  "r": {
    published: D,
    tutorials: [],
    related: ["python", "julia", "matlab", "sql"],
    sources: [
      { title: "An Introduction to R (CRAN manual)", href: "https://cran.r-project.org/doc/manuals/r-release/R-intro.html" },
      { title: "The R Project for Statistical Computing", href: "https://www.r-project.org/" },
    ],
  },
  "sql": {
    published: D,
    tutorials: [],
    related: ["python", "r", "php"],
    sources: [
      { title: "PostgreSQL documentation: Tutorial", href: "https://www.postgresql.org/docs/current/tutorial.html" },
      { title: "MySQL 8.4 Reference Manual", href: "https://dev.mysql.com/doc/refman/8.4/en/" },
      { title: "SQLite: SQL as understood by SQLite", href: "https://www.sqlite.org/lang.html" },
    ],
  },
  "bash": {
    published: D,
    tutorials: ["read-cron", "test-regex"],
    related: ["powershell", "perl", "python"],
    sources: [
      { title: "GNU Bash Reference Manual", href: "https://www.gnu.org/software/bash/manual/bash.html" },
      { title: "POSIX Shell Command Language (The Open Group)", href: "https://pubs.opengroup.org/onlinepubs/9799919799/utilities/V3_chap02.html" },
    ],
  },
  "powershell": {
    published: D,
    tutorials: [],
    related: ["bash", "csharp", "python"],
    sources: [
      { title: "PowerShell documentation: What is PowerShell?", href: "https://learn.microsoft.com/en-us/powershell/scripting/overview" },
      { title: "PowerShell 101", href: "https://learn.microsoft.com/en-us/powershell/scripting/learn/ps101/00-introduction" },
    ],
  },
  "lua": {
    published: D,
    tutorials: [],
    related: ["python", "javascript", "ruby"],
    sources: [
      { title: "Lua 5.4 Reference Manual", href: "https://www.lua.org/manual/5.4/" },
      { title: "Programming in Lua (first edition)", href: "https://www.lua.org/pil/contents.html" },
    ],
  },
  "perl": {
    published: D,
    tutorials: ["test-regex"],
    related: ["bash", "python", "ruby"],
    sources: [
      { title: "perlintro: a brief introduction and overview of Perl", href: "https://perldoc.perl.org/perlintro" },
      { title: "Perl documentation", href: "https://perldoc.perl.org/" },
    ],
  },
  "haskell": {
    published: D,
    tutorials: [],
    related: ["ocaml", "fsharp", "scala", "recursion"],
    sources: [
      { title: "Haskell documentation", href: "https://www.haskell.org/documentation/" },
      { title: "A Gentle Introduction to Haskell", href: "https://www.haskell.org/tutorial/" },
      { title: "GHCup installer", href: "https://www.haskell.org/ghcup/" },
    ],
  },
  "elixir": {
    published: D,
    tutorials: [],
    related: ["erlang", "ruby", "haskell"],
    sources: [
      { title: "Elixir documentation: Introduction", href: "https://hexdocs.pm/elixir/introduction.html" },
      { title: "Elixir language website", href: "https://elixir-lang.org/" },
    ],
  },
  "erlang": {
    published: D,
    tutorials: [],
    related: ["elixir", "haskell", "go"],
    sources: [
      { title: "Erlang/OTP documentation", href: "https://www.erlang.org/doc/" },
      { title: "Erlang System Documentation: Getting Started", href: "https://www.erlang.org/doc/system/getting_started.html" },
    ],
  },
  "clojure": {
    published: D,
    tutorials: [],
    related: ["java", "haskell", "elixir", "scala"],
    sources: [
      { title: "Clojure: Getting Started", href: "https://clojure.org/guides/getting_started" },
      { title: "Clojure: Learn Clojure", href: "https://clojure.org/guides/learn/clojure" },
      { title: "Clojure reference: The Reader", href: "https://clojure.org/reference/reader" },
    ],
  },
  "fsharp": {
    published: D,
    tutorials: [],
    related: ["ocaml", "csharp", "haskell"],
    sources: [
      { title: "Microsoft Learn: F# documentation", href: "https://learn.microsoft.com/en-us/dotnet/fsharp/" },
      { title: "Microsoft Learn: Tour of F#", href: "https://learn.microsoft.com/en-us/dotnet/fsharp/tour" },
      { title: "Microsoft Learn: Get started with F#", href: "https://learn.microsoft.com/en-us/dotnet/fsharp/get-started/" },
    ],
  },
  "ocaml": {
    published: D,
    tutorials: [],
    related: ["fsharp", "haskell", "rust"],
    sources: [
      { title: "OCaml documentation", href: "https://ocaml.org/docs" },
      { title: "OCaml: A Tour of OCaml", href: "https://ocaml.org/docs/tour-of-ocaml" },
      { title: "The OCaml Manual", href: "https://ocaml.org/manual/" },
    ],
  },
  "julia": {
    published: D,
    tutorials: [],
    related: ["python", "matlab", "r", "fortran"],
    sources: [
      { title: "Julia documentation (manual)", href: "https://docs.julialang.org/en/v1/" },
      { title: "Julia manual: Getting Started", href: "https://docs.julialang.org/en/v1/manual/getting-started/" },
      { title: "Julia: Learning resources", href: "https://julialang.org/learning/" },
    ],
  },
  "zig": {
    published: D,
    tutorials: [],
    related: ["c", "rust", "go"],
    sources: [
      { title: "Zig Language Reference", href: "https://ziglang.org/documentation/master/" },
      { title: "Zig: Learn", href: "https://ziglang.org/learn/" },
      { title: "Zig: Getting Started", href: "https://ziglang.org/learn/getting-started/" },
    ],
  },
  "fortran": {
    published: D,
    tutorials: [],
    related: ["c", "julia", "matlab", "cobol"],
    sources: [
      { title: "Fortran-lang: Learn Fortran", href: "https://fortran-lang.org/learn/" },
      { title: "Fortran-lang: Quickstart tutorial", href: "https://fortran-lang.org/learn/quickstart/" },
      { title: "The GNU Fortran Compiler manual", href: "https://gcc.gnu.org/onlinedocs/gfortran/" },
    ],
  },
  "cobol": {
    published: D,
    tutorials: [],
    related: ["fortran", "sql", "java"],
    sources: [
      { title: "GnuCOBOL", href: "https://gnucobol.sourceforge.io/" },
      { title: "GNU Project: GnuCOBOL", href: "https://www.gnu.org/software/gnucobol/" },
      { title: "IBM Documentation: Enterprise COBOL for z/OS", href: "https://www.ibm.com/docs/en/cobol-zos" },
    ],
  },
  "assembly": {
    published: D,
    tutorials: ["convert-base"],
    related: ["c", "cpp", "rust", "zig"],
    sources: [
      { title: "NASM documentation", href: "https://www.nasm.us/docs.php" },
      { title: "Intel 64 and IA-32 Architectures Software Developer Manuals", href: "https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html" },
      { title: "System V Application Binary Interface: x86-64 psABI", href: "https://gitlab.com/x86-psABIs/x86-64-ABI" },
      { title: "Arm Developer documentation", href: "https://developer.arm.com/documentation/" },
    ],
  },
  "visual-basic": {
    published: D,
    tutorials: [],
    related: ["csharp", "fsharp", "powershell"],
    sources: [
      { title: "Microsoft Learn: Visual Basic documentation", href: "https://learn.microsoft.com/en-us/dotnet/visual-basic/" },
      { title: "Microsoft Learn: Get started with Visual Basic", href: "https://learn.microsoft.com/en-us/dotnet/visual-basic/getting-started/" },
      { title: "Microsoft Learn: Office VBA reference", href: "https://learn.microsoft.com/en-us/office/vba/api/overview/" },
    ],
  },
  "objective-c": {
    published: D,
    tutorials: [],
    related: ["swift", "c", "cpp"],
    sources: [
      { title: "Apple: Programming with Objective-C", href: "https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/ProgrammingWithObjectiveC/Introduction/Introduction.html" },
      { title: "Clang: Objective-C Automatic Reference Counting (ARC)", href: "https://clang.llvm.org/docs/AutomaticReferenceCounting.html" },
    ],
  },
  "matlab": {
    published: D,
    tutorials: [],
    related: ["julia", "python", "r", "fortran"],
    sources: [
      { title: "MathWorks: MATLAB documentation", href: "https://www.mathworks.com/help/matlab/" },
      { title: "GNU Octave documentation", href: "https://docs.octave.org/latest/" },
    ],
  },
  "design-patterns": {
    published: D,
    tutorials: [],
    related: ["solid-principles", "strategy", "observer", "factory-method"],
    sources: [
      { title: "Design Patterns: Elements of Reusable Object-Oriented Software (InformIT)", href: "https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610" },
      { title: "Peter Norvig: Design Patterns in Dynamic Languages", href: "https://norvig.com/design-patterns/" },
    ],
  },
  "solid-principles": {
    published: D,
    tutorials: [],
    related: ["design-patterns", "strategy", "decorator", "abstract-factory"],
    sources: [
      { title: "Robert C. Martin: Design Principles and Design Patterns (2000, archived PDF)", href: "https://web.archive.org/web/20150906155800/http://www.objectmentor.com/resources/articles/Principles_and_Patterns.pdf" },
      { title: "Robert C. Martin: Agile Software Development, Principles, Patterns, and Practices (InformIT)", href: "https://www.informit.com/store/agile-software-development-principles-patterns-and-practices-9780135974445" },
      { title: "Liskov and Wing: A Behavioral Notion of Subtyping (ACM, 1994)", href: "https://dl.acm.org/doi/10.1145/197320.197383" },
    ],
  },
  "singleton": {
    published: D,
    tutorials: [],
    related: ["design-patterns", "factory-method", "facade", "flyweight"],
    sources: [
      { title: "Design Patterns: Elements of Reusable Object-Oriented Software (InformIT)", href: "https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610" },
      { title: "Java SE 21 API: java.lang.Runtime", href: "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Runtime.html" },
      { title: "Node.js documentation: Modules (caching)", href: "https://nodejs.org/api/modules.html" },
    ],
  },
  "factory-method": {
    published: D,
    tutorials: [],
    related: ["abstract-factory", "template-method", "prototype", "builder"],
    sources: [
      { title: "Design Patterns: Elements of Reusable Object-Oriented Software (InformIT)", href: "https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610" },
      { title: "Java SE 21 API: java.lang.Iterable", href: "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Iterable.html" },
      { title: "MDN: Symbol.iterator", href: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/iterator" },
    ],
  },
  "abstract-factory": {
    published: D,
    tutorials: [],
    related: ["factory-method", "builder", "prototype", "bridge"],
    sources: [
      { title: "Design Patterns: Elements of Reusable Object-Oriented Software (InformIT)", href: "https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610" },
      { title: "Java SE 21 API: javax.xml.parsers.DocumentBuilderFactory", href: "https://docs.oracle.com/en/java/javase/21/docs/api/java.xml/javax/xml/parsers/DocumentBuilderFactory.html" },
      { title: "The Java Tutorials: JDBC Introduction", href: "https://docs.oracle.com/javase/tutorial/jdbc/overview/index.html" },
    ],
  },
  "builder": {
    published: D,
    tutorials: [],
    related: ["abstract-factory", "factory-method", "composite", "prototype"],
    sources: [
      { title: "Design Patterns: Elements of Reusable Object-Oriented Software (InformIT)", href: "https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610" },
      { title: "Java SE 21 API: java.net.http.HttpRequest.Builder", href: "https://docs.oracle.com/en/java/javase/21/docs/api/java.net.http/java/net/http/HttpRequest.Builder.html" },
      { title: "Java SE 21 API: java.util.Locale.Builder", href: "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Locale.Builder.html" },
    ],
  },
  "prototype": {
    published: D,
    tutorials: [],
    related: ["abstract-factory", "factory-method", "memento", "builder"],
    sources: [
      { title: "Design Patterns: Elements of Reusable Object-Oriented Software (InformIT)", href: "https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610" },
      { title: "MDN: structuredClone()", href: "https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone" },
      { title: "MDN: Node.cloneNode()", href: "https://developer.mozilla.org/en-US/docs/Web/API/Node/cloneNode" },
      { title: "Java SE 21 API: java.lang.Cloneable", href: "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Cloneable.html" },
    ],
  },
  "adapter": {
    published: D,
    tutorials: [],
    related: ["facade", "decorator", "proxy", "bridge"],
    sources: [
      { title: "Design Patterns: Elements of Reusable Object-Oriented Software (InformIT)", href: "https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610" },
      { title: "Node.js documentation: util.promisify()", href: "https://nodejs.org/api/util.html" },
      { title: "Java SE 21 API: java.util.Arrays", href: "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Arrays.html" },
    ],
  },
  "bridge": {
    published: D,
    tutorials: [],
    related: ["adapter", "strategy", "abstract-factory", "composite"],
    sources: [
      { title: "Design Patterns: Elements of Reusable Object-Oriented Software (InformIT)", href: "https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610" },
      { title: "The Java Tutorials: JDBC Introduction", href: "https://docs.oracle.com/javase/tutorial/jdbc/overview/index.html" },
    ],
  },
  "composite": {
    published: D,
    tutorials: [],
    related: ["decorator", "iterator", "visitor", "builder"],
    sources: [
      { title: "Design Patterns: Elements of Reusable Object-Oriented Software (InformIT)", href: "https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610" },
      { title: "MDN: Node interface", href: "https://developer.mozilla.org/en-US/docs/Web/API/Node" },
      { title: "Java SE 21 API: java.awt.Container", href: "https://docs.oracle.com/en/java/javase/21/docs/api/java.desktop/java/awt/Container.html" },
    ],
  },
  "decorator": {
    published: D,
    tutorials: [],
    related: ["proxy", "adapter", "composite", "chain-of-responsibility"],
    sources: [
      { title: "Design Patterns: Elements of Reusable Object-Oriented Software (InformIT)", href: "https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610" },
      { title: "Java SE 21 API: java.io.BufferedInputStream", href: "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/io/BufferedInputStream.html" },
      { title: "TypeScript Handbook: Decorators", href: "https://www.typescriptlang.org/docs/handbook/decorators.html" },
      { title: "Python documentation: functools", href: "https://docs.python.org/3/library/functools.html" },
    ],
  },
  "facade": {
    published: D,
    tutorials: [],
    related: ["adapter", "mediator", "singleton", "proxy"],
    sources: [
      { title: "Design Patterns: Elements of Reusable Object-Oriented Software (InformIT)", href: "https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610" },
      { title: "Node.js documentation: File system (fs.readFile)", href: "https://nodejs.org/api/fs.html" },
    ],
  },
  "flyweight": {
    published: D,
    tutorials: [],
    related: ["singleton", "factory-method", "composite", "proxy"],
    sources: [
      { title: "Gamma, Helm, Johnson, Vlissides: Design Patterns (Addison-Wesley)", href: "https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610" },
      { title: "Java SE 21 API: Integer.valueOf", href: "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Integer.html" },
      { title: "Java SE 21 API: String.intern", href: "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/String.html" },
    ],
  },
  "proxy": {
    published: D,
    tutorials: [],
    related: ["decorator", "adapter", "facade", "flyweight"],
    sources: [
      { title: "Gamma, Helm, Johnson, Vlissides: Design Patterns (Addison-Wesley)", href: "https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610" },
      { title: "MDN Web Docs: Proxy", href: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy" },
      { title: "Java SE 21 API: java.lang.reflect.Proxy", href: "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/reflect/Proxy.html" },
      { title: "Vue.js guide: Reactivity in Depth", href: "https://vuejs.org/guide/extras/reactivity-in-depth.html" },
    ],
  },
  "chain-of-responsibility": {
    published: D,
    tutorials: [],
    related: ["command", "decorator", "mediator", "composite"],
    sources: [
      { title: "Gamma, Helm, Johnson, Vlissides: Design Patterns (Addison-Wesley)", href: "https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610" },
      { title: "Express guide: Using middleware", href: "https://expressjs.com/en/guide/using-middleware.html" },
      { title: "MDN Web Docs: Event.stopPropagation()", href: "https://developer.mozilla.org/en-US/docs/Web/API/Event/stopPropagation" },
    ],
  },
  "command": {
    published: D,
    tutorials: [],
    related: ["memento", "strategy", "chain-of-responsibility", "composite"],
    sources: [
      { title: "Gamma, Helm, Johnson, Vlissides: Design Patterns (Addison-Wesley)", href: "https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610" },
      { title: "Java SE 21 API: Runnable", href: "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Runnable.html" },
      { title: "Redux docs: Three Principles", href: "https://redux.js.org/understanding/thinking-in-redux/three-principles" },
    ],
  },
  "interpreter": {
    published: D,
    tutorials: [],
    related: ["composite", "visitor", "iterator"],
    sources: [
      { title: "Gamma, Helm, Johnson, Vlissides: Design Patterns (Addison-Wesley)", href: "https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610" },
      { title: "Python documentation: ast — Abstract Syntax Trees", href: "https://docs.python.org/3/library/ast.html" },
      { title: "ESTree specification", href: "https://github.com/estree/estree" },
    ],
  },
  "iterator": {
    published: D,
    tutorials: [],
    related: ["composite", "visitor", "factory-method", "binary-tree-traversal"],
    sources: [
      { title: "Gamma, Helm, Johnson, Vlissides: Design Patterns (Addison-Wesley)", href: "https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610" },
      { title: "MDN Web Docs: Iteration protocols", href: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols" },
      { title: "Java SE 21 API: Iterator", href: "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Iterator.html" },
      { title: "Python documentation: Iterator types", href: "https://docs.python.org/3/library/stdtypes.html#iterator-types" },
    ],
  },
  "mediator": {
    published: D,
    tutorials: [],
    related: ["observer", "facade", "command", "chain-of-responsibility"],
    sources: [
      { title: "Gamma, Helm, Johnson, Vlissides: Design Patterns (Addison-Wesley)", href: "https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610" },
      { title: "React docs: Sharing State Between Components", href: "https://react.dev/learn/sharing-state-between-components" },
    ],
  },
  "memento": {
    published: D,
    tutorials: [],
    related: ["command", "prototype", "state", "iterator"],
    sources: [
      { title: "Gamma, Helm, Johnson, Vlissides: Design Patterns (Addison-Wesley)", href: "https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610" },
      { title: "MDN Web Docs: History API", href: "https://developer.mozilla.org/en-US/docs/Web/API/History_API" },
      { title: "MDN Web Docs: structuredClone()", href: "https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone" },
    ],
  },
  "observer": {
    published: D,
    tutorials: [],
    related: ["mediator", "command", "iterator"],
    sources: [
      { title: "Gamma, Helm, Johnson, Vlissides: Design Patterns (Addison-Wesley)", href: "https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610" },
      { title: "MDN Web Docs: EventTarget", href: "https://developer.mozilla.org/en-US/docs/Web/API/EventTarget" },
      { title: "Node.js documentation: Events", href: "https://nodejs.org/api/events.html" },
      { title: "Java SE 21 API: java.util.Observable (deprecated)", href: "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Observable.html" },
    ],
  },
  "state": {
    published: D,
    tutorials: [],
    related: ["strategy", "memento", "flyweight", "singleton"],
    sources: [
      { title: "Gamma, Helm, Johnson, Vlissides: Design Patterns (Addison-Wesley)", href: "https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610" },
      { title: "Stately docs: XState", href: "https://stately.ai/docs" },
      { title: "W3C: State Chart XML (SCXML)", href: "https://www.w3.org/TR/scxml/" },
    ],
  },
  "strategy": {
    published: D,
    tutorials: [],
    related: ["state", "template-method", "command", "solid-principles"],
    sources: [
      { title: "Gamma, Helm, Johnson, Vlissides: Design Patterns (Addison-Wesley)", href: "https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610" },
      { title: "MDN Web Docs: Array.prototype.sort()", href: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort" },
      { title: "Java SE 21 API: Comparator", href: "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Comparator.html" },
      { title: "Passport.js documentation: Strategies", href: "https://www.passportjs.org/concepts/authentication/strategies/" },
    ],
  },
  "template-method": {
    published: D,
    tutorials: [],
    related: ["strategy", "factory-method", "solid-principles"],
    sources: [
      { title: "Gamma, Helm, Johnson, Vlissides: Design Patterns (Addison-Wesley)", href: "https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610" },
      { title: "Java SE 21 API: AbstractList", href: "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/AbstractList.html" },
      { title: "Java SE 21 API: InputStream", href: "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/io/InputStream.html" },
    ],
  },
  "visitor": {
    published: D,
    tutorials: [],
    related: ["composite", "interpreter", "iterator", "strategy"],
    sources: [
      { title: "Gamma, Helm, Johnson, Vlissides: Design Patterns (Addison-Wesley)", href: "https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610" },
      { title: "Babel documentation: @babel/traverse", href: "https://babeljs.io/docs/babel-traverse" },
      { title: "Python documentation: ast — Abstract Syntax Trees", href: "https://docs.python.org/3/library/ast.html" },
      { title: "Java SE 21 API: FileVisitor", href: "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/nio/file/FileVisitor.html" },
    ],
  },
  "linked-list": {
    published: D,
    tutorials: [],
    related: ["stack-and-queue", "lru-cache", "hash-table", "two-pointers"],
    sources: [
      { title: "Princeton Algorithms, 4th ed.: 1.3 Bags, Queues, and Stacks (linked lists)", href: "https://algs4.cs.princeton.edu/13stacks/" },
      { title: "Python documentation: collections.deque", href: "https://docs.python.org/3/library/collections.html" },
    ],
  },
  "stack-and-queue": {
    published: D,
    tutorials: [],
    related: ["linked-list", "binary-heap", "breadth-first-search", "depth-first-search"],
    sources: [
      { title: "Princeton Algorithms, 4th ed.: 1.3 Bags, Queues, and Stacks", href: "https://algs4.cs.princeton.edu/13stacks/" },
      { title: "Python tutorial: Using lists as stacks and queues", href: "https://docs.python.org/3/tutorial/datastructures.html" },
      { title: "Python documentation: collections.deque", href: "https://docs.python.org/3/library/collections.html" },
    ],
  },
  "hash-table": {
    published: D,
    tutorials: [],
    related: ["linked-list", "lru-cache", "binary-search-tree", "big-o-notation"],
    sources: [
      { title: "Princeton Algorithms, 4th ed.: 3.4 Hash Tables", href: "https://algs4.cs.princeton.edu/34hash/" },
      { title: "Python documentation: Mapping types, dict", href: "https://docs.python.org/3/library/stdtypes.html" },
      { title: "MIT OpenCourseWare 6.006 Introduction to Algorithms (Spring 2020)", href: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/" },
    ],
  },
  "binary-search-tree": {
    published: D,
    tutorials: [],
    related: ["binary-tree-traversal", "binary-search", "hash-table", "binary-heap"],
    sources: [
      { title: "Princeton Algorithms, 4th ed.: 3.2 Binary Search Trees", href: "https://algs4.cs.princeton.edu/32bst/" },
      { title: "MIT OpenCourseWare 6.006 Introduction to Algorithms (Spring 2020)", href: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/" },
    ],
  },
  "binary-tree-traversal": {
    published: D,
    tutorials: [],
    related: ["binary-search-tree", "depth-first-search", "breadth-first-search", "recursion"],
    sources: [
      { title: "Princeton Algorithms, 4th ed.: 3.2 Binary Search Trees", href: "https://algs4.cs.princeton.edu/32bst/" },
      { title: "MIT OpenCourseWare 6.006 Introduction to Algorithms (Spring 2020)", href: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/" },
    ],
  },
  "binary-heap": {
    published: D,
    tutorials: [],
    related: ["heapsort", "dijkstra", "stack-and-queue", "binary-search-tree"],
    sources: [
      { title: "Python documentation: heapq, heap queue algorithm", href: "https://docs.python.org/3/library/heapq.html" },
      { title: "Princeton Algorithms, 4th ed.: 2.4 Priority Queues", href: "https://algs4.cs.princeton.edu/24pq/" },
    ],
  },
  "trie": {
    published: D,
    tutorials: [],
    related: ["hash-table", "binary-search-tree", "depth-first-search", "kmp-string-search"],
    sources: [
      { title: "Princeton Algorithms, 4th ed.: 5.2 Tries", href: "https://algs4.cs.princeton.edu/52trie/" },
    ],
  },
  "union-find": {
    published: D,
    tutorials: [],
    related: ["minimum-spanning-tree", "breadth-first-search", "depth-first-search", "hash-table"],
    sources: [
      { title: "Princeton Algorithms, 4th ed.: 1.5 Case Study: Union-Find", href: "https://algs4.cs.princeton.edu/15uf/" },
      { title: "MIT OpenCourseWare 6.006 Introduction to Algorithms (Spring 2020)", href: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/" },
    ],
  },
  "lru-cache": {
    published: D,
    tutorials: [],
    related: ["linked-list", "hash-table", "dynamic-programming"],
    sources: [
      { title: "Python documentation: functools.lru_cache", href: "https://docs.python.org/3/library/functools.html" },
      { title: "Python documentation: collections.OrderedDict", href: "https://docs.python.org/3/library/collections.html" },
    ],
  },
  "big-o-notation": {
    published: D,
    tutorials: [],
    related: ["binary-search", "merge-sort", "recursion", "hash-table"],
    sources: [
      { title: "Princeton Algorithms, 4th ed.: 1.4 Analysis of Algorithms", href: "https://algs4.cs.princeton.edu/14analysis/" },
      { title: "MIT OpenCourseWare 6.006: Lecture 1, Algorithms and Computation", href: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/lecture-1-algorithms-and-computation/" },
      { title: "Python Wiki: TimeComplexity", href: "https://wiki.python.org/moin/TimeComplexity" },
    ],
  },
  "recursion": {
    published: D,
    tutorials: [],
    related: ["dynamic-programming", "backtracking", "merge-sort", "depth-first-search"],
    sources: [
      { title: "Princeton Computer Science: 2.3 Recursion", href: "https://introcs.cs.princeton.edu/java/23recursion/" },
      { title: "Python documentation: sys.getrecursionlimit", href: "https://docs.python.org/3/library/sys.html" },
      { title: "Python documentation: functools.lru_cache", href: "https://docs.python.org/3/library/functools.html" },
    ],
  },
  "binary-search": {
    published: D,
    tutorials: [],
    related: ["big-o-notation", "binary-search-tree", "two-pointers", "recursion"],
    sources: [
      { title: "Python documentation: bisect, array bisection algorithm", href: "https://docs.python.org/3/library/bisect.html" },
      { title: "Princeton Algorithms, 4th ed.: 3.1 Elementary Symbol Tables (binary search)", href: "https://algs4.cs.princeton.edu/31elementary/" },
      { title: "MIT OpenCourseWare 6.006: Lecture 3, Sets and Sorting", href: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/lecture-3-sets-and-sorting/" },
    ],
  },
  "two-pointers": {
    published: D,
    tutorials: [],
    related: ["binary-search", "linked-list", "hash-table", "big-o-notation"],
    sources: [
      { title: "MIT OpenCourseWare 6.006: Introduction to Algorithms", href: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/" },
      { title: "Princeton Algorithms, 4th ed.: 1.4 Analysis of Algorithms (2-sum and 3-sum)", href: "https://algs4.cs.princeton.edu/14analysis/" },
      { title: "Python documentation: Built-in types (sequences)", href: "https://docs.python.org/3/library/stdtypes.html" },
    ],
  },
  "bubble-sort": {
    published: D,
    tutorials: [],
    related: ["insertion-sort", "selection-sort", "merge-sort", "big-o-notation"],
    sources: [
      { title: "Princeton Algorithms, 4th ed.: 2.1 Elementary Sorts", href: "https://algs4.cs.princeton.edu/21elementary/" },
      { title: "Python documentation: Sorting Techniques", href: "https://docs.python.org/3/howto/sorting.html" },
    ],
  },
  "selection-sort": {
    published: D,
    tutorials: [],
    related: ["insertion-sort", "bubble-sort", "heapsort", "big-o-notation"],
    sources: [
      { title: "Princeton Algorithms, 4th ed.: 2.1 Elementary Sorts", href: "https://algs4.cs.princeton.edu/21elementary/" },
      { title: "Princeton Algorithms, 4th ed.: 2.5 Sorting Applications (stability)", href: "https://algs4.cs.princeton.edu/25applications/" },
    ],
  },
  "insertion-sort": {
    published: D,
    tutorials: [],
    related: ["bubble-sort", "selection-sort", "merge-sort", "binary-search"],
    sources: [
      { title: "Princeton Algorithms, 4th ed.: 2.1 Elementary Sorts", href: "https://algs4.cs.princeton.edu/21elementary/" },
      { title: "Python documentation: Sorting Techniques", href: "https://docs.python.org/3/howto/sorting.html" },
      { title: "Python documentation: bisect", href: "https://docs.python.org/3/library/bisect.html" },
    ],
  },
  "merge-sort": {
    published: D,
    tutorials: [],
    related: ["quicksort", "heapsort", "recursion", "insertion-sort"],
    sources: [
      { title: "Princeton Algorithms, 4th ed.: 2.2 Mergesort", href: "https://algs4.cs.princeton.edu/22mergesort/" },
      { title: "MIT OpenCourseWare 6.006: Lecture 3, Sets and Sorting", href: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/lecture-3-sets-and-sorting/" },
      { title: "Python documentation: Sorting Techniques", href: "https://docs.python.org/3/howto/sorting.html" },
    ],
  },
  "quicksort": {
    published: D,
    tutorials: [],
    related: ["merge-sort", "heapsort", "recursion", "big-o-notation"],
    sources: [
      { title: "Princeton Algorithms, 4th ed.: 2.3 Quicksort", href: "https://algs4.cs.princeton.edu/23quicksort/" },
      { title: "Princeton Algorithms, 4th ed.: 2.5 Sorting Applications", href: "https://algs4.cs.princeton.edu/25applications/" },
    ],
  },
  "heapsort": {
    published: D,
    tutorials: [],
    related: ["binary-heap", "quicksort", "merge-sort", "selection-sort"],
    sources: [
      { title: "Princeton Algorithms, 4th ed.: 2.4 Priority Queues (heapsort)", href: "https://algs4.cs.princeton.edu/24pq/" },
      { title: "MIT OpenCourseWare 6.006: Lecture 8, Binary Heaps", href: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/lecture-8-binary-heaps/" },
      { title: "Python documentation: heapq, heap queue algorithm", href: "https://docs.python.org/3/library/heapq.html" },
    ],
  },
  "counting-sort": {
    published: D,
    tutorials: [],
    related: ["radix-sort", "merge-sort", "quicksort", "big-o-notation"],
    sources: [
      { title: "MIT OpenCourseWare 6.006: Lecture 5, Linear Sorting", href: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/lecture-5-linear-sorting/" },
      { title: "Princeton Algorithms, 4th ed.: 5.1 String Sorts (key-indexed counting)", href: "https://algs4.cs.princeton.edu/51radix/" },
      { title: "Python documentation: collections.Counter", href: "https://docs.python.org/3/library/collections.html" },
    ],
  },
  "radix-sort": {
    published: D,
    tutorials: ["convert-base"],
    related: ["counting-sort", "merge-sort", "quicksort", "bit-manipulation"],
    sources: [
      { title: "Princeton Algorithms, 4th ed.: 5.1 String Sorts (LSD and MSD radix sort)", href: "https://algs4.cs.princeton.edu/51radix/" },
      { title: "MIT OpenCourseWare 6.006: Lecture 5, Linear Sorting", href: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/lecture-5-linear-sorting/" },
    ],
  },
  "breadth-first-search": {
    published: D,
    tutorials: [],
    related: ["depth-first-search", "dijkstra", "a-star-search", "stack-and-queue"],
    sources: [
      { title: "Princeton Algorithms, 4th ed.: Undirected Graphs (4.1)", href: "https://algs4.cs.princeton.edu/41graph/" },
      { title: "MIT OCW 6.006 Introduction to Algorithms (Spring 2020)", href: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/" },
      { title: "Python documentation: collections.deque", href: "https://docs.python.org/3/library/collections.html" },
    ],
  },
  "depth-first-search": {
    published: D,
    tutorials: [],
    related: ["breadth-first-search", "topological-sort", "backtracking", "recursion"],
    sources: [
      { title: "Princeton Algorithms, 4th ed.: Undirected Graphs (4.1)", href: "https://algs4.cs.princeton.edu/41graph/" },
      { title: "Princeton Algorithms, 4th ed.: Directed Graphs (4.2)", href: "https://algs4.cs.princeton.edu/42digraph/" },
      { title: "MIT OCW 6.006 Introduction to Algorithms (Spring 2020)", href: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/" },
    ],
  },
  "dijkstra": {
    published: D,
    tutorials: [],
    related: ["breadth-first-search", "bellman-ford", "a-star-search", "binary-heap"],
    sources: [
      { title: "E. W. Dijkstra (1959), A note on two problems in connexion with graphs, Numerische Mathematik", href: "https://doi.org/10.1007/BF01386390" },
      { title: "Princeton Algorithms, 4th ed.: Shortest Paths (4.4)", href: "https://algs4.cs.princeton.edu/44sp/" },
      { title: "Python documentation: heapq — Heap queue algorithm", href: "https://docs.python.org/3/library/heapq.html" },
    ],
  },
  "bellman-ford": {
    published: D,
    tutorials: [],
    related: ["dijkstra", "floyd-warshall", "dynamic-programming"],
    sources: [
      { title: "Princeton Algorithms, 4th ed.: Shortest Paths (4.4)", href: "https://algs4.cs.princeton.edu/44sp/" },
      { title: "MIT OCW 6.006 Introduction to Algorithms (Spring 2020)", href: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/" },
    ],
  },
  "floyd-warshall": {
    published: D,
    tutorials: [],
    related: ["dijkstra", "bellman-ford", "dynamic-programming"],
    sources: [
      { title: "R. W. Floyd (1962), Algorithm 97: Shortest path, Communications of the ACM", href: "https://doi.org/10.1145/367766.368168" },
      { title: "Princeton Algorithms, 4th ed.: Shortest Paths (4.4)", href: "https://algs4.cs.princeton.edu/44sp/" },
      { title: "MIT OCW 6.006 Introduction to Algorithms (Spring 2020)", href: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/" },
    ],
  },
  "a-star-search": {
    published: D,
    tutorials: [],
    related: ["dijkstra", "breadth-first-search", "binary-heap"],
    sources: [
      { title: "Hart, Nilsson and Raphael (1968), A Formal Basis for the Heuristic Determination of Minimum Cost Paths, IEEE", href: "https://doi.org/10.1109/TSSC.1968.300136" },
      { title: "Python documentation: heapq — Heap queue algorithm", href: "https://docs.python.org/3/library/heapq.html" },
    ],
  },
  "topological-sort": {
    published: D,
    tutorials: [],
    related: ["depth-first-search", "breadth-first-search", "dynamic-programming"],
    sources: [
      { title: "Princeton Algorithms, 4th ed.: Directed Graphs (4.2)", href: "https://algs4.cs.princeton.edu/42digraph/" },
      { title: "Python documentation: graphlib — Functionality to operate with graph-like structures", href: "https://docs.python.org/3/library/graphlib.html" },
      { title: "MIT OCW 6.006 Introduction to Algorithms (Spring 2020)", href: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/" },
    ],
  },
  "minimum-spanning-tree": {
    published: D,
    tutorials: [],
    related: ["union-find", "greedy-algorithms", "dijkstra", "binary-heap"],
    sources: [
      { title: "Princeton Algorithms, 4th ed.: Minimum Spanning Trees (4.3)", href: "https://algs4.cs.princeton.edu/43mst/" },
      { title: "J. B. Kruskal (1956), On the shortest spanning subtree of a graph, Proceedings of the AMS", href: "https://doi.org/10.1090/S0002-9939-1956-0078686-7" },
      { title: "MIT OCW 6.046J Design and Analysis of Algorithms (Spring 2015)", href: "https://ocw.mit.edu/courses/6-046j-design-and-analysis-of-algorithms-spring-2015/" },
    ],
  },
  "dynamic-programming": {
    published: D,
    tutorials: [],
    related: ["recursion", "greedy-algorithms", "backtracking", "big-o-notation"],
    sources: [
      { title: "MIT OCW 6.006 Introduction to Algorithms (Spring 2020)", href: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/" },
      { title: "MIT OCW 6.046J Design and Analysis of Algorithms (Spring 2015)", href: "https://ocw.mit.edu/courses/6-046j-design-and-analysis-of-algorithms-spring-2015/" },
      { title: "Python documentation: functools — cache and lru_cache", href: "https://docs.python.org/3/library/functools.html" },
    ],
  },
  "greedy-algorithms": {
    published: D,
    tutorials: [],
    related: ["dynamic-programming", "minimum-spanning-tree", "dijkstra"],
    sources: [
      { title: "MIT OCW 6.046J Design and Analysis of Algorithms (Spring 2015)", href: "https://ocw.mit.edu/courses/6-046j-design-and-analysis-of-algorithms-spring-2015/" },
      { title: "Princeton Algorithms, 4th ed.: Minimum Spanning Trees (4.3)", href: "https://algs4.cs.princeton.edu/43mst/" },
    ],
  },
  "backtracking": {
    published: D,
    tutorials: [],
    related: ["recursion", "depth-first-search", "dynamic-programming"],
    sources: [
      { title: "MIT OCW 6.006 Introduction to Algorithms (Spring 2020)", href: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/" },
      { title: "Python documentation: itertools — permutations and combinations", href: "https://docs.python.org/3/library/itertools.html" },
    ],
  },
  "kmp-string-search": {
    published: D,
    tutorials: ["test-regex"],
    related: ["two-pointers", "trie", "big-o-notation"],
    sources: [
      { title: "Knuth, Morris and Pratt (1977), Fast Pattern Matching in Strings, SIAM Journal on Computing", href: "https://doi.org/10.1137/0206024" },
      { title: "Princeton Algorithms, 4th ed.: Substring Search (5.3)", href: "https://algs4.cs.princeton.edu/53substring/" },
    ],
  },
  "bit-manipulation": {
    published: D,
    tutorials: ["convert-base"],
    related: ["dynamic-programming", "big-o-notation", "backtracking"],
    sources: [
      { title: "Python documentation: Bitwise operations on integer types", href: "https://docs.python.org/3/library/stdtypes.html#bitwise-operations-on-integer-types" },
      { title: "Python documentation: int.bit_count and int.bit_length", href: "https://docs.python.org/3/library/stdtypes.html#int.bit_count" },
    ],
  },
};

registerCodeShelf({
  meta: Object.fromEntries(CODE_ARTICLES.map((id) => [id, { ...META[id], tools: [...(CODE_TOOLS[id] ?? [])] }])) as Record<CodeId, KbMeta>,
  updated: CODE_UPDATED,
  minutes: CODE_MINUTES,
});
