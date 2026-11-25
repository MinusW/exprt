---
author: ""
lang: en
papersize: a4
fontsize: 7.9pt
columns: 2
column-gutter: 8pt
linestretch: 1.0
geometry: "margin=0.35cm"
theme: compact
number-sections: false
table-of-contents: false
bibliography: false
kroki_url: "https://kroki.io"
---

## 1. Git, GitHub & Markdown

- **Merge conflict fix:** Open file, resolve `<<<<<<<` / `=======` / `>>>>>>>`, remove markers, `git add <file>`, `git commit` (or `git rebase --continue`).
- **Three areas:** Working Dir $\xrightarrow{\text{add}}$ Staging $\xrightarrow{\text{commit}}$ Local Repo $\xrightarrow{\text{push}}$ Remote.
- **`.gitignore`:** Ignores untracked files only (`git rm --cached <file>` untracks committed files; `!pattern` negates).
- **Rejected push:** `git pull --rebase` replays local commits on `origin`, then `git push`.
- **SSH & GPG:** `ssh -T git@github.com`; `gpg.format ssh`, `user.signingkey`, `commit.gpgSign true`.
- **PR lifecycle (exact order):** 1) Issue *(optional)* $\to$ 2) Branch $\to$ 3) Development $\to$ 4) Open PR $\to$ 5) Code Review $\to$ 6) Modifications $\to$ 7) Approval $\to$ 8) Merge $\to$ 9) Close PR & Issue $\to$ 10) Delete branch *(optional)*.
- **Markdown:** `# H1`, `## H2`, `[link](https://url)`, `![img](https://url/img.png)`, `- bullet`, `1. numbered`, table (`| A | B |` + `|---|---|`), fenced code (`~~~java ... ~~~` or triple backticks).

## 2. Java, IntelliJ, Maven, picocli & JUnit

| Component | Role |
| :--- | :--- |
| **JVM** | Runs `.class` bytecode (WORA: run on any OS) + GC. |
| **JRE** | JVM + standard libraries (run-only). |
| **JDK** | JRE + `javac` (`javac A.java` $\to$ `java A`; JAR = `.class` + resources, `java -jar app.jar`). |
| **SDKMAN!** | Switches JDKs (`sdk list/install/use/default java`). |

- **Maven (`pom.xml`):** Manages dependencies, builds, tests, and JARs.
  - *Layout:* `src/main/java`, `src/main/resources`, `src/test/java`, `target/`.
  - *GAV:* `groupId`, `artifactId`, `version`. `<scope>test</scope>` excluded from JAR. Run `./mvnw clean package`.
  - *Lifecycle:* `validate` $\to$ `compile` $\to$ `test` $\to$ `package` $\to$ `verify` $\to$ `install` $\to$ `deploy` (runs all prior phases). `maven-shade-plugin` builds an executable fat JAR.
- **IntelliJ (`.idea/`):** Share `.idea/` (except `workspace.xml`) for consistent team compiler/run/style settings.
- **JUnit 5:** `@Test` in `src/test/java`, `assertEquals(expected, actual)`, run via `./mvnw test`.

```java
// picocli CLI (use @ParentCommand in subcommands)
@Command(name="app", mixinStandardHelpOptions=true)
class App implements Callable<Integer> {
  @Option(names={"-n","--num"}) int n = 1;
  @Parameters(index="0", defaultValue="hi") String m;
  public Integer call() { System.out.println(m); return 0; }
  public static void main(String[] a) {
    System.exit(new CommandLine(new App()).execute(a));
  }
}
```

## 3. Java I/O (Binary vs. Text)

- **Core idea (decorator chain):** Raw stream (reads/writes bytes from file or socket) $\to$ **Buffered** wrapper (batches OS calls for speed) $\to$ **Reader/Writer** (converts bytes $\leftrightarrow$ UTF-8 text).
- **Binary vs. Text rules:**
  - *Binary:* `InputStream`/`OutputStream` (no charset!). `read()` returns `int` `0–255` or `-1` at EOF (**never** `!= 0`). `write(int)` keeps only low 8 bits.
  - *Text:* `Reader`/`Writer` — always pass `StandardCharsets.UTF_8` (otherwise OS default causes garbled text). `readLine()` strips `\n`/`\r\n` and returns `null` at EOF. On sockets, write `"\n"` or `"\r\n"` explicitly (not `newLine()`).
  - *Lifecycle:* `try-with-resources` closes in LIFO order even on exception. Always `flush()` buffered output before reading a reply.
- **String size vs. bytes (for a 4-byte emoji `s`, e.g. `U+1F680`):**
  - `s.length()` = **2** (UTF-16 `char` code units; `"é"` = 1).
  - `s.codePointCount(0, s.length())` = **1** (actual Unicode character).
  - `s.getBytes(UTF_8).length` = **4** (bytes on disk/wire; `"é"` = 2, ASCII = 1, 7-bit, 128 chars; UTF-8 = 1–4 bytes for all Unicode alphabets).
- **Endianness (multi-byte numbers):** Big-Endian = MSB first (`0x12345678` $\to$ `12 34 56 78`, network & `DataInputStream`). Little-Endian = LSB first (`ByteBuffer.order(ByteOrder.LITTLE_ENDIAN)`, BMP/WAV).

```java
// Text file read & write (UTF-8, line by line)
var u8 = StandardCharsets.UTF_8;
try (var in = new BufferedReader(new FileReader("in.txt", u8));
     var out = new BufferedWriter(new FileWriter("out.txt", u8))) {
  String line;
  while ((line = in.readLine()) != null) {
    out.write(line + "\n"); // readLine() strips \n
  }
  out.flush();
}
```

```java
// Binary file read & write (no charset, block buffer)
try (var in = new BufferedInputStream(new FileInputStream("a.png"));
     var out = new BufferedOutputStream(new FileOutputStream("b.png"))) {
  byte[] buf = new byte[8192]; int n;
  while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
  out.flush(); // write(buf,0,n) avoids stale trailing bytes
}
```

## 4. Docker & Docker Compose

- **VM vs. Container:** VM virtualizes hardware + guest OS; container shares host kernel (namespaces, cgroups). Image = immutable blueprint (OCI standard); container = writable instance.
- **Networking & storage:** Bind servers to `0.0.0.0` (**not** `127.0.0.1`) inside containers. Named volumes persist data; bind mounts expose host files. Same-network services resolve by service name (Docker DNS).
- **CLI:** `docker build -t app .` (`--platform linux/amd64` on Apple Silicon); `docker run -d --rm -it -p host:container -v vol:/path --name c app`; `docker ps -a`, `docker logs -f c`, `docker exec -it c sh`, `docker stop/rm c`, `docker compose up -d` / `down`.

```dockerfile
# Dockerfile (build steps; copy pom.xml before src/ for caching)
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY target/app.jar /app/app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
CMD ["--help"] # default args passed to ENTRYPOINT
```

```yaml
# compose.yaml (orchestrates services, networks, volumes)
services:                 # defines containers to run
  web:                    # service name (also DNS hostname)
    image: nginx:latest   # image to pull (or build: .)
    ports: ["8080:80"]    # map host:container port
    networks: [my-net]    # attach service to network
networks:                 # declare shared networks
  my-net:                 # bridge network for DNS discovery
```

## 5. SMTP, Email & `ncat`

| Protocol | Direction & Role |
| :--- | :--- |
| **SMTP** | Pushes mail: MUA $\to$ MSA (`587` STARTTLS / `465` SMTPS) or MTA (`25`, unencrypted) $\to$ MTA. No default auth/encryption $\to$ spam/spoofing risk. Use Mailpit in dev to test safely. |
| **IMAP** | Pulls mail with multi-device synchronization. |
| **POP3** | Downloads mail to a single device. |

- **DNS & anti-spoofing:**
  - *`MX` record:* Lowest preference number = highest priority.
  - *SPF:* Lists authorized sender IPs for `MAIL FROM`.
  - *DKIM:* Cryptographic signature verifying message integrity.
  - *DMARC:* Aligns `From:` with SPF/DKIM (`p=reject`/`quarantine`).
- **`ncat`:** `ncat -C host 1025` (**`-C` sends `\r\n` CRLF**; without it, `\r\n.\r\n` never ends `DATA`). Listen as server: `ncat -l 2525`.
- **SMTP wire dialogue (server speaks first):**
  - `S: 220` $\to$ `C: EHLO` $\to$ `S: 250-` / `250 ` (hyphen = more; space = last).
  - `C: MAIL FROM:` $\to$ `C: RCPT TO:` (envelope = delivery/Bcc; `From:`/`To:` inside `DATA` = display headers only).
  - `C: DATA` (`354`) $\to$ headers + blank line + dot-stuffed body (leading `.` $\to$ `..`) + `\r\n.\r\n` (`250`) $\to$ `QUIT` (`221`).
- **Reply codes:** `2xx` OK, `3xx` intermediate, `4xx` temp fail, `5xx` perm fail.

## 6. Defining an Application Protocol

- **Standards & addressing:** Protocols are defined in RFCs. An IP identifies a host; a port identifies a process (`0–1023` well-known/reserved, `1024–49151` registered — **on Linux, use `1024–32767`** since ephemeral ports start at `32768`; IANA dynamic `49152–65535`).
- **Four mandatory sections (and why each matters):**
  - **1. Overview:** Purpose, scope, actors $\to$ aligns implementers.
  - **2. Transport & Connection:** TCP/UDP, port, encoding (UTF-8/binary), framing (`\n`, length-prefix, fixed-size), who speaks first, who closes $\to$ interoperable byte transport.
  - **3. Messages:** Exact commands, mandatory/optional fields, state rules, responses, error codes $\to$ eliminates parsing ambiguity.
  - **4. Examples:** Concrete sequences & error flows $\to$ verifies edges.
- **Extensibility:** Return explicit error on unknown commands and keep connection open. Inspect first keyword on every read if async pushes exist.

## 7. Java TCP & UDP Programming

- **TCP (`ServerSocket` / `Socket`):** Connection-oriented, reliable, ordered (ACKs, sequence numbers, retransmission, flow/congestion control). Byte stream without message boundaries (needs `\n` framing). Unicast only; REPL loop keeps TCP open for multiple commands. *Use:* files, web, chat.
- **UDP (`DatagramSocket` / `DatagramPacket`):** Connectionless, fire-and-forget (no reply), unreliable (lost, duplicated, or reordered; app must handle it). Preserves datagram boundaries (max ~65,507 B). Unicast (1:1), broadcast (1:all, `255.255.255.255`), multicast (1:group, `224.0.0.0/4`, LAN-only). Discovery: active = query; passive = periodic announce. *Use:* streaming, games, discovery.
- **Exam bug-hunt checklist (9 classic faults):**
  - *1)* Missing port in `new ServerSocket(1234)`.
  - *2)* Missing `Socket s = serverSocket.accept()` inside `while (!ss.isClosed())`.
  - *3)* Missing `try-with-resources` (leaks sockets and streams).
  - *4)* Missing `BufferedReader`/`Writer` (or `BufferedInput`/`OutputStream`).
  - *5)* Missing `StandardCharsets.UTF_8` on text — or charset on binary `FileInputStream`.
  - *6)* Missing `"\n"` on text `write()`, or `readLine()` on binary.
  - *7)* Missing `out.flush()` before reading a reply or closing.
  - *8)* Wrong EOF: `!= -1` for binary `read()` (**never** `!= 0`); `!= null` for `readLine()`.
  - *9)* UDP `DatagramPacket`: reset `pkt.setLength(buf.length)` before every `receive()`, and set `ds.setSoTimeout(ms)` to avoid blocking forever.

\columnbreak

```java
// TCP Text Client (Server: ServerSocket(1234).accept())
var u8 = StandardCharsets.UTF_8;
try (Socket s = new Socket("localhost", 1234);
  var in = new BufferedReader(new InputStreamReader(s.getInputStream(), u8));
  var out = new BufferedWriter(new OutputStreamWriter(s.getOutputStream(), u8))) {
  out.write("Hello\n"); out.flush();
  String reply = in.readLine();
}
```

```java
// UDP Send, Receive & Java 14+ Multicast
var u8 = StandardCharsets.UTF_8;
try (var ds = new DatagramSocket(9876)) {
  byte[] b = "hi".getBytes(u8), rx = new byte[1024];
  ds.send(new DatagramPacket(b, b.length, InetAddress.getByName("localhost"), 9876));
  var p = new DatagramPacket(rx, rx.length);
  p.setLength(rx.length); ds.receive(p);
  var m = new String(p.getData(), 0, p.getLength(), u8);
}
// MulticastSocket ms = new MulticastSocket(port);
// ms.joinGroup(new InetSocketAddress("239.0.0.1", port), NetworkInterface.getByName("eth0"));
```

| Chat Mode | TCP vs. UDP Trade-offs |
| :--- | :--- |
| **Private** | TCP: dedicated connection per client; server relays C1 $\to$ server $\to$ C2. UDP: unicast; needs discovery server + app-level ACKs/sequence numbers. |
| **Group** | TCP: server loops over participant list. UDP: multicast on LAN (single send), or server unicast loop on WAN. |

## 8. Java Network Concurrency

- **Iterative server & processes vs. threads:** Single-threaded `accept()` blocks other clients (timeouts, lost requests). Threads share memory and use far fewer resources than processes. Fix: thread pool or virtual threads.
- **Platform pool vs. virtual threads (Java 21+):**
  - *Fixed pool:* `Executors.newFixedThreadPool(N)` reuses `N` OS threads (~1 MB stack each); bounds resources, caps blocking I/O concurrency at `N`.
  - *Virtual threads:* `Executors.newVirtualThreadPerTaskExecutor()` uses M:N lightweight threads that unmount on blocking I/O (thousands of clients).
  - *Auto-shutdown:* `try (ExecutorService ex = ...)` (Java 19+) awaits finish.
- **Race conditions & thread-safe types:** `count++` is non-atomic (lost updates). Use `AtomicInteger`/`AtomicLong`/`AtomicBoolean`, `ConcurrentHashMap` (`merge()`, `compute()`, `putIfAbsent()` — never `containsKey()` + `put()`), `CopyOnWriteArrayList`/`Set`, `ConcurrentLinkedQueue`.
- **Exception trap:** `ex.submit(Runnable)` **swallows** uncaught exceptions inside `Future` until `Future.get()` is called; always wrap task logic in `try/catch`.

```java
var active = new AtomicInteger(0);
var map = new ConcurrentHashMap<String, Integer>();
try (var ss = new ServerSocket(1234);
  var ex = Executors.newVirtualThreadPerTaskExecutor()) {
  while (!ss.isClosed()) {
    Socket s = ss.accept();
    ex.submit(() -> {
      active.incrementAndGet(); map.merge("req", 1, Integer::sum);
      try (s) { /* handle client */ } catch (IOException e) { e.printStackTrace(); }
      finally { active.decrementAndGet(); }
    });
  }
}
```
