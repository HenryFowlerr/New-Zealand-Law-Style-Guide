/**
 * Citations taken verbatim from the published New Zealand Law Style Guide,
 * Third Edition, at lawfoundation.org.nz/style-guide2019 — NOT from the JSON
 * ingested into this repository.
 *
 * That distinction is the whole point. Every test we had compared the engine
 * against our own ingested copy of the Guide, so an ingestion error was
 * invisible: the data said one thing, the engine agreed with it, and both could
 * be wrong together. These strings were read off the Guide's own pages, so they
 * can disagree with our data — and where they do, our data is what is wrong.
 *
 * Each entry records the rule it appears under and the chapter page it was read
 * from, so any of them can be checked by hand against the source.
 */
export type GuideCitation = {
  /** The source type this citation belongs to, or "" where none fits yet. */
  typeId: string;
  /** Verbatim from the Guide. */
  text: string;
  /** The rule the Guide files it under. */
  rule: string;
  /** Set where the Guide's form is one our templates cannot yet express. */
  note?: string;
};

export const GUIDE_CORPUS: GuideCitation[] = [
  // ══════════════════════════════════════════════════ 3 — Cases (chapter-3)
  { typeId: "neutral-citation-case-nz", rule: "3.1(a)", text: "Erwood v Ministry of Social Development [2010] NZCA 619 at [35]." },
  { typeId: "neutral-citation-case-nz", rule: "3.1(a)", text: "North Shore City Council v Attorney-General [2010] NZSC 125." },
  { typeId: "reported-case-nz", rule: "3.1(a)", text: "AstraZeneca Ltd v Commerce Commission [2009] NZSC 92, [2010] 1 NZLR 297 at [29]." },
  { typeId: "reported-case-nz", rule: "3.1(a)", text: "Commerce Commission v Progressive Enterprises Ltd [2010] NZCA 374, (2010) 12 TCLR 736 at [38]." },
  { typeId: "reported-case-nz", rule: "3.1(b)", text: "Hawkins v Minister of Justice [1991] 2 NZLR 530 (CA) at 534." },
  { typeId: "reported-case-nz", rule: "3.1(b)", text: "Burrows v Rental Space Ltd (2001) 15 PRNZ 298 (HC) at [14]." },
  { typeId: "unreported-case-file-number-nz", rule: "3.1(c)", text: "Shell New Zealand Ltd v Porirua City Council CA57/05, 19 May 2005 at [5]." },
  { typeId: "unreported-case-file-number-nz", rule: "3.1(c)", text: "Marlborough Lines Ltd v Takeovers Panel HC Wellington CIV-2010-485-1150, 12 October 2010 at [89]." },
  { typeId: "reported-case-nz", rule: "3.2", text: "Z v Dental Complaints Assessment Committee [2008] NZSC 55, [2009] 1 NZLR 1 at [26]." },
  { typeId: "reported-case-nz", rule: "3.2", text: "Body Corporate 202254 v Taylor [2008] NZCA 317, [2009] 2 NZLR 17 at [76(c)]." },
  { typeId: "reported-case-nz", rule: "3.2", text: "Taylor v New Zealand Poultry Board [1984] 1 NZLR 394 (CA) at 398." },
  { typeId: "neutral-citation-case-nz", rule: "3.3", text: "Attorney-General v X [2007] NZCA 388 at [70]." },
  { typeId: "neutral-citation-case-nz", rule: "3.3", text: "Craggy Range Vineyards Ltd v Campbell [2008] NZCA 96." },
  { typeId: "unreported-case-file-number-nz", rule: "3.4", text: "R v Reekie CA339/03, 3 August 2004 at [35]." },
  { typeId: "unreported-case-file-number-nz", rule: "3.4", text: "R v Tuhou HC Napier CRI-2007-020-2820, 11 September 2008 at [13]." },
  { typeId: "unreported-case-file-number-nz", rule: "3.4", text: "Plot Ltd v Brereton HC Christchurch CIV-2007-409-2659, 17 January 2008." },
  { typeId: "unreported-case-file-number-nz", rule: "3.4", text: "Chirnside v Fay SC CIV 7/2004, 26 August 2004." },
  { typeId: "unreported-case-file-number-nz", rule: "3.4", text: "Greenbaum v Waikato District Health Board ERA Auckland AA506/10, 10 December 2010." },
  { typeId: "maori-land-court", rule: "3.5", text: "Pacey v Adlam – Matata Parish 39A 2B 2B 2A (2017) 178 Waiariki MB 32 (178 WAR 32)." },
  { typeId: "maori-land-court", rule: "3.5", text: "Craig v Kira – Wainui 2F4D (2006) 7 Taitokerau Appellate MB 1 (7 APWH 1)." },

  // ═══════════════════════════════════════════ 4 — Legislation (chapter-4)
  { typeId: "nz-statute", rule: "4.1.1(a)", text: "Gaming Duties Act 1971, s 9." },
  { typeId: "nz-statute", rule: "4.1.1(a)", text: "Judicature Amendment Act 1972, s 4." },
  { typeId: "nz-statute", rule: "4.1.1(c)", text: "New Zealand Bill of Rights Act 1990, long title." },
  { typeId: "nz-statute", rule: "4.1.1(c)", text: "Evidence Act 2006, s 43." },
  { typeId: "nz-statute", rule: "4.1.1(d)", text: "Crimes Act 1961, s 59." },
  { typeId: "nz-statute", rule: "4.1.1(d)", text: "Trustee Act 1956, s 67(2)." },
  { typeId: "nz-statute", rule: "4.1.1(d)", text: "Banking Act 1982, s 2(a)(ii)." },
  { typeId: "nz-statute", rule: "4.1.1(d)", text: "Property Law Act 2007, sch 3 cl 4." },
  { typeId: "nz-statute", rule: "4.1.1(d)", text: "Property (Relationships) Act 1976, s 2 definition of “family chattels”, para (b)." },
  { typeId: "nz-statute", rule: "4.1.4(a)", text: "Evidence Act 2006, s 44." },
  { typeId: "nz-statute", rule: "4.1.4(a)", text: "Income Tax Act 2004, s CE 10." },
  { typeId: "treaty-of-waitangi", rule: "4.1.1(e)", text: "Te Tiriti o Waitangi 1840, art 3." },
  { typeId: "treaty-of-waitangi", rule: "4.1.1(e)", text: "Treaty of Waitangi 1840, art 3." },
  { typeId: "treaty-of-waitangi", rule: "4.1.1(e)", text: "He Whakaputanga o te Rangatiratanga o Nu Tirene 1835." },
  { typeId: "treaty-of-waitangi", rule: "4.1.1(e)", text: "Declaration of Independence of the United Tribes of New Zealand 1835." },
  { typeId: "nz-pre-1854-ordinance", rule: "4.1.3(a)", text: "Distillation Prohibition Ordinance 1841 4 Vict 5, cl 1." },
  { typeId: "nz-pre-1854-ordinance", rule: "4.1.3(a)", text: "Scab Ordinance of New Munster 1849 13 Vict 4." },
  { typeId: "nz-pre-1854-ordinance", rule: "4.1.3(a)", text: "Supreme Court Practitioners Ordinance 1853 16 Vict 5." },
  { typeId: "nz-provincial-legislation", rule: "4.1.4(d)", text: "Manawatu Racecourse Act 1869 (Wellington)." },
  { typeId: "nz-provincial-legislation", rule: "4.1.4(d)", text: "Otago Harbour Trust Leasing Ordinance 1862 (Otago)." },
  { typeId: "nz-provincial-legislation", rule: "4.1.4(d)", text: "Nelson Waterworks Act 1863 (Nelson)." },
  { typeId: "nz-provincial-legislation", rule: "4.1.4(d)", text: "Picton Institution Act 1864 (Marlborough)." },
  { typeId: "nz-provincial-legislation", rule: "4.1.4(d)", text: "Christ’s College Ordinance 1855 (Canterbury)." },

  // Bills, select committee reports, supplementary order papers (4.2)
  { typeId: "bill", rule: "4.2.1", text: "Judicial Matters Bill 2008 (216-1), cl 3." },
  { typeId: "bill", rule: "4.2.1", text: "Arms Amendment Bill (No 3) 2005 (248-1)." },
  { typeId: "bill", rule: "4.2.1", text: "Securities Legislation Bill 2004 (234-2)." },
  { typeId: "bill", rule: "4.2.1", text: "Business Law Reform Bill 2003 (56-2)." },
  { typeId: "bill", rule: "4.2.1", text: "Judicial Retirement Age Bill 2006 (90)." },
  { typeId: "bill", rule: "4.2.1", text: "Education (Tertiary Reform) Amendment Bill 2001 (180-3A)." },
  { typeId: "bill", rule: "4.2.1", text: "Industry Training Amendment Bill 2001 (180-3B)." },
  { typeId: "bill", rule: "4.2.1", text: "Animal Products Amendment Bill 2001 (194-3)." },
  { typeId: "bill", rule: "4.2.1", text: "Animal Products (Ancillary and Transitional Provisions) Amendment Bill 2001 (194-3A)." },
  { typeId: "bill-select-committee-report-explanatory-note", rule: "4.2.2", text: "Judicial Matters Bill 2008 (216-1) (explanatory note) at 5." },
  { typeId: "bill-select-committee-report-explanatory-note", rule: "4.2.2", text: "Unit Titles Bill 2008 (212-2) (select committee report) at 4." },
  { typeId: "supplementary-order-paper", rule: "4.2.3", text: "Supplementary Order Paper 2006 (79) Evidence Bill 2005 (256-1) (explanatory note) at 3." },

  // Secondary legislation (4.3)
  { typeId: "legislative-instrument", rule: "4.3.1", text: "Costs in Criminal Cases Regulations 1987, reg 3." },
  { typeId: "legislative-instrument", rule: "4.3.1", text: "Personal Property Securities Regulations 2001, reg 18." },
  { typeId: "legislative-instrument", rule: "4.3.1", text: "Lotto Amendment Rules 2010, r 6." },
  { typeId: "legislative-instrument", rule: "4.3.1", text: "Minimum Wage Order 2010, cl 4(a)." },
  { typeId: "legislative-instrument", rule: "4.3.1", text: "Wildlife (Canada Goose) Order 2011, cl 4." },
  { typeId: "court-rules", rule: "4.3.3", text: "Supreme Court Rules 2004, r 4." },
  { typeId: "court-rules", rule: "4.3.3", text: "High Court Rules 2016, r 14.3." },
  { typeId: "other-instrument-dinli", rule: "4.3.4", text: "Civil Aviation Rules, r 19.5." },
  { typeId: "other-instrument-dinli", rule: "4.3.4", text: "Electricity Industry Participation Code 2010, cl 10.15." },
  { typeId: "other-instrument-dinli", rule: "4.3.4", text: "Telecommunications Information Privacy Code 2003, r 3." },
  { typeId: "letters-patent", rule: "4.3.5", text: "Letters Patent Constituting the Office of the Governor-General of New Zealand 1983, cl 12." },
  { typeId: "letters-patent", rule: "4.3.5", text: "Letters Patent Constituting the Office of Governor-General and Commander-in-Chief of the Dominion of New Zealand 1917, cl 2." },
  // These four were transcribed with the Gazette abbreviated to "NZ Gazette",
  // and the proclamation's title without its quotation marks. Re-read off
  // chapter-pt.4.3.2, 4.3.6 and 5.2.4: the Guide writes "New Zealand Gazette"
  // in full in every one of its examples and never abbreviates it, and 4.3.6's
  // example quotes the title. Four of the audit's failures were this fixture,
  // not the engine — which is exactly the mistake this file exists to catch,
  // pointing the other way.
  //
  // Rules 4.3.2 and 4.3.6 both say to cite "in accordance with rule 5.2.4", so
  // these citations are printed under 4.3.x and governed by 5.2.4. The rule
  // recorded here is where the Guide prints them.
  { typeId: "proclamation", rule: "4.3.6", text: "“Proclamation Dissolving the Parliament of New Zealand” (12 August 2005) 124 New Zealand Gazette 3031." },
  { typeId: "nz-gazette", rule: "4.3.2", text: "“Royal Commission on the Pike River Coal Mine Tragedy” (16 December 2010) 173 New Zealand Gazette 4261 at 4262." },
  { typeId: "nz-gazette", rule: "4.3.2", text: "“Reference to the Court of Appeal of the Question of the Convictions of David Cullen Bain for Murder” (6 March 2003) 22 New Zealand Gazette 689 at cl 5." },
  { typeId: "nz-gazette", rule: "4.3.2", text: "“Commission of Inquiry into Police Conduct” (19 February 2004) 18 New Zealand Gazette 379 at 381." },
  { typeId: "nz-gazette", rule: "5.2.4", text: "“Declaration of State of Local Emergency” (23 March 2018) New Zealand Gazette No 2018-go941." },
  { typeId: "nz-gazette", rule: "5.2.4", text: "“Register of Pharmacies” (24 August 2001) 100 New Zealand Gazette 2597 at 2601." },
  { typeId: "nz-gazette", rule: "5.2.4", text: "“Australia New Zealand Food Standards Code – Amendment No 171” (13 July 2017) 73 New Zealand Gazette 127 at 128." },

  // ══════════════════════════ 5 — Parliamentary and official (chapter-5)
  { typeId: "hansard", rule: "5.1.1", text: "(6 April 2005) 624 NZPD 19676." },
  { typeId: "hansard", rule: "5.1.1", text: "(1 November 1990) 178 GBPD HC 1088." },
  { typeId: "hansard", rule: "5.1.1", text: "(8 July 1996) 574 GBPD HL 1." },
  { typeId: "hansard", rule: "5.1.1", text: "(16 August 2017) 724 NZPD (Maritime Transport Amendment Bill – Second Reading, Julie Anne Genter)." },
  { typeId: "hansard", rule: "5.1.1", text: "(9 November 2017) 725 NZPD (Address in Reply, Steven Joyce)." },
  { typeId: "ajhr", rule: "5.1.2", text: "Geoffrey Palmer “A Bill of Rights for New Zealand: A White Paper” [1984–1985] I AJHR A6 at 29." },
  { typeId: "select-committee-submission", rule: "5.1.3", text: "New Zealand Law Society “Submission to the Justice and Electoral Committee on the Arbitration Amendment Bill 2017” at [3]." },
  { typeId: "standing-orders", rule: "5.1.4", text: "Standing Orders of the House of Representatives 2017, SO 265(5)." },
  { typeId: "cabinet-manual", rule: "5.2.2", text: "Cabinet Office Cabinet Manual 2008 at [2.91]." },
  { typeId: "law-commission-report", rule: "5.2.3", text: "Law Commission The Prosecution of Offences (NZLC PP12, 1990) at 2." },
  { typeId: "law-commission-report", rule: "5.2.3", text: "Law Commission Forfeiture under the Customs and Excise Act 1996 (NZLC R91, 2006)." },
  { typeId: "law-commission-report", rule: "5.2.3", text: "Law Commission Tribunal Reform (NZLC SP20, 2008)." },

  // ══════════════════════════════════ 6 — Secondary sources (chapter-6)
  { typeId: "text-book", rule: "6.1.1", text: "Ross Carter Burrows and Carter Statute Law in New Zealand (5th ed, LexisNexis, Wellington, 2015) at 311." },
  { typeId: "text-book", rule: "6.1.1", text: "Andrew Butler and Petra Butler The New Zealand Bill of Rights Act: A Commentary (2nd ed, LexisNexis, Wellington, 2015)." },
  { typeId: "text-book", rule: "6.1.1", text: "Roger Fenton Garrow and Fenton’s Law of Personal Property in New Zealand (7th ed, LexisNexis, Wellington, 2010) vol 2 at [2.2.20]." },
  { typeId: "text-book", rule: "6.1.2", text: "Patricia Londono, David Eady and ATH Smith Arlidge, Eady & Smith on Contempt (5th ed, Sweet & Maxwell, London, 2017) at [3-85]." },
  { typeId: "text-book", rule: "6.1.2", text: "Geoffrey Palmer Unbridled Power? An interpretation of New Zealand’s constitution and government (Oxford University Press, Wellington, 1979)." },
  { typeId: "text-book", rule: "6.1.2", text: "Lord Goff and Gareth Jones The Law of Restitution (7th ed, Sweet & Maxwell, London, 2007)." },
  { typeId: "text-book", rule: "6.1.2", text: "Grant Hammond Judicial Recusal: Principles, Process and Problems (Hart Publishing, Portland, 2009)." },
  { typeId: "text-book", rule: "6.1.2", text: "Lord Denning The Discipline of Law (Butterworths, London, 1979)." },
  { typeId: "text-book", rule: "6.1.2", text: "Peter W Hogg, Patrick J Monahan and Wade K Wright Liability of the Crown (4th ed, Carswell, Toronto, 2011)." },
  { typeId: "text-book", rule: "6.1.2", text: "Richard Mahoney and others The Evidence Act 2006: Act & Analysis (3rd ed, Brookers, Wellington, 2014)." },
  { typeId: "text-book", rule: "6.1.2", text: "Peter Blanchard (ed) Civil Remedies in New Zealand (2nd ed, Brookers, Wellington, 2011)." },
  { typeId: "text-book", rule: "6.1.3", text: "Matthew Smith NZ Judicial Review Handbook (2nd ed, Thomson Reuters, Wellington, 2016)." },
  { typeId: "text-book", rule: "6.1.4", text: "FAR Bennion Statutory Interpretation (Butterworths, London, 1984)." },
  { typeId: "text-book", rule: "6.1.4", text: "Diggory Bailey and Luke Norbury Bennion on Statutory Interpretation (7th ed, LexisNexis, London, 2017)." },
  { typeId: "text-book", rule: "6.1.5", text: "Greg Kelly and Chris Kelly Garrow and Kelly Law of Trusts and Trustees (7th ed, LexisNexis, Wellington, 2013)." },
  { typeId: "text-book", rule: "6.1.6", text: "James Boyle Shamans Software and Spleens: Law and the Construction of the Information Society (Harvard University Press, Cambridge (Mass), 1996)." },
  { typeId: "text-book", rule: "6.1.6", text: "JD Heydon, MJ Leeming and PG Turner Meagher, Gummow and Lehane’s Equity: Doctrines & Remedies (5th ed, LexisNexis Butterworths, Chatswood (NSW), 2015)." },
  { typeId: "text-book", rule: "6.1.8", text: "Peter Watts Directors’ Powers and Duties (2nd ed, LexisNexis, Wellington, 2015) at 164." },
  { typeId: "text-book", rule: "6.1.8", text: "JD Heydon and MJ Leeming Jacobs’ Law of Trusts in Australia (8th ed, LexisNexis Butterworths, Chatswood (NSW), 2016) at [1206]." },
  { typeId: "text-book", rule: "6.1.8", text: "Peter Spiller The Disputes Tribunals of New Zealand (2nd ed, Brookers, Wellington, 2003) at ch 1." },
  { typeId: "text-book", rule: "6.1.8", text: "HG Beale (ed) Chitty on Contracts (32nd ed, Sweet & Maxwell, London, 2015) vol 2 at [38–033]." },
  { typeId: "text-book", rule: "6.1.8", text: "Andrew Burrows The Law of Restitution (3rd ed, Oxford University Press, Oxford, 2011) at 189, n 92." },
  { typeId: "ebook-electronic-only", rule: "6.1.9", text: "Geoffrey Robertson The Case of the Pope: Vatican Accountability for Human Rights Abuse (Penguin Books, London, 2010) at [94]." },
  { typeId: "ebook-electronic-only", rule: "6.1.9", text: "Paul Grussendorf My Trials: What I Learned in Immigration Court – Inside America’s Deportation Factories (2nd ed, eBook ed, eBooks by Barb, 2011)." },

  // Essays and chapters in edited books (6.2)
  { typeId: "essay-in-edited-book", rule: "6.2", text: "Robin Cooke “Tort and Contract” in PD Finn (ed) Essays on Contract (Law Book Company, Sydney, 1987) 222 at 229." },
  { typeId: "essay-in-edited-book", rule: "6.2", text: "Jessica Palmer “Constructive Trusts” in Andrew Butler (ed) Equity and Trusts in New Zealand (2nd ed, Thomson Reuters, Wellington, 2009) 335 at 339." },
  { typeId: "essay-in-edited-book", rule: "6.2", text: "Scott Optican “Search and Seizure” in Paul Rishworth and others The New Zealand Bill of Rights (Oxford University Press, Melbourne, 2003) 418 at 425." },
  { typeId: "essay-in-edited-book", rule: "6.2", text: "John Finnis “Practical Reason’s Foundations” in Reason in Action: Collected Essays Volume 1 (Oxford University Press, Oxford, 2011) 19 at 37." },
  { typeId: "essay-in-edited-book", rule: "6.1.2", text: "Michael Taggart “Rugby, the Anti-apartheid Movement, and Administrative Law” in Rick Bigwood (ed) Public Interest Litigation: New Zealand Experience in International Perspective (LexisNexis, Wellington, 2006) 69 at 81." },
  { typeId: "essay-in-edited-book", rule: "6.1.9", text: "Philip A Joseph “The Rule of Law: Foundational Norm” in Richard Ekins (ed) Modern Challenges to the Rule of Law (LexisNexis, Wellington, 2011) 47 at 53." },

  // Looseleaf and online commentary (6.3)
  { typeId: "looseleaf-online-commentary", rule: "6.3", text: "Simon France (ed) Adams on Criminal Law – Evidence (looseleaf ed, Thomson Reuters) at [ED1.01(2)]." },
  { typeId: "looseleaf-online-commentary", rule: "6.3", text: "Mathew Downs (ed) Cross on Evidence (online ed, LexisNexis) at [1.2]." },

  // Journal articles (6.4)
  { typeId: "journal-article", rule: "6.4", text: "Peter Watts “Birks’ Unjust Enrichment” (2005) 121 LQR 163 at 165." },
  { typeId: "journal-article", rule: "6.4", text: "Michael Taggart “From ‘Parliamentary Powers’ to Privatization: The Chequered History of Delegated Legislation in the Twentieth Century” (2005) 55 U Toronto LJ 575." },
  { typeId: "journal-article", rule: "6.4", text: "Leonard Rotman “‘My Hovercraft is Full of Eels’: Smoking Out the Message in R v Marshall” (2000) 63 Sask L Rev 617 at 618." },
  { typeId: "journal-article", rule: "6.4", text: "Jessica Palmer “Theories of the Trust and What They Might Mean for Beneficiary Rights to Information” [2010] NZ L Rev 541." },
  { typeId: "journal-article", rule: "6.4", text: "Paul Rishworth “Common Law Rights and Navigation Lights: Judicial Review and the New Zealand Bill of Rights” (2004) 15 PLR 103 at 107." },
  { typeId: "journal-article", rule: "6.4", text: "Bernard Meltzer “Organisational Picketing and the NLRB: Five on a Seesaw” (1962) 30 U Chi L Rev 78." },
  { typeId: "journal-article", rule: "6.4", text: "Ben Mathews and Kerryann Walsh “At the Cutting Edge: Issues in Mandatory Reporting of Child Sexual Abuse by Australian Teachers” (2004) 9(2) Australia & New Zealand Journal of Law & Education 3." },
  { typeId: "journal-article", rule: "6.4", text: "Christopher Eisgruber and Lawrence Sager “The Vulnerability of Conscience: The Constitutional Basis for Protecting Religious Conduct” (1994) 61 U Chi L Rev 1245." },
  { typeId: "journal-article", rule: "6.4", text: "Catriona MacLennan “Radical criminal pre-trial changes” (2009) 733 LawTalk 7." },
  { typeId: "journal-article", rule: "6.4", text: "Stephen Todd “Wrongful Conception, Wrongful Birth and Wrongful Life” (2005) 27 Syd LR 525." },
  { typeId: "journal-article", rule: "6.4", text: "Kent Greenawalt “Moral and Religious Convictions as Categories for Special Treatment: The Exemption Strategy” (2007) 48 Wm & Mary L Rev 1605." },
  { typeId: "journal-article", rule: "6.4", text: "J K Maxton “Equity” [1994] NZ Recent Law Review 245." },
  { typeId: "journal-article", rule: "6.4", text: "Jesse Wilson “Prior Restraint of the Press” [2006] NZ Law Review 551." },
  { typeId: "journal-article", rule: "6.4", text: "Scott Optican “‘Front-End’/‘Back-End’ Adjudication (Rights Versus Remedies) Under Section 21 of the New Zealand Bill of Rights Act 1990” [2008] NZ L Rev 409." },
  { typeId: "journal-article", rule: "6.4", text: "Campbell McLachlan “The Principle of Systemic Integration and Article 31(3)(c) of the Vienna Convention” (2005) 54 ICLQ 279 at 279." },
  { typeId: "journal-article", rule: "6.4", text: "Peter Devonshire “Fraud on a Power: A Doctrine in Retreat” [2010] NZ L Rev 503 at 511, n 46." },

  // Encyclopaedias (6.5, 6.6)
  { typeId: "legal-encyclopaedia", rule: "6.5", text: "Halsbury’s Laws of England (5th ed, 2017) vol 9 Children and Young Persons at [651]." },
  { typeId: "laws-of-new-zealand", rule: "6.6", text: "Charles Rickett Laws of New Zealand Equity at [98]." },

  // ═════════════════════════════════════════ 7 — Other sources (chapter-7)
  { typeId: "internet-material", rule: "7.1.1", text: "Dean Knight “Parliament and the Bill of Rights – a blasé attitude?” (6 April 2009) LAWS179 Elephants and the Law <www.laws179.co.nz>." },
  { typeId: "internet-material", rule: "7.1.1", text: "John Corcoran “Timor, Tampa and technology” (November 2001) Law Institute of Victoria <www.liv.asn.au>." },
  { typeId: "internet-material", rule: "7.1.1", text: "Federico Varese “The Secret History of Japanese Cinema: The Yakuza Movies” (14 May 2006) Social Science Research Network <www.ssrn.com> at 14." },
  { typeId: "internet-material", rule: "7.1.4", text: "Steven Price “Super-injunctions Debunked” (10 May 2011) Media Law Journal <www.medialawjournal.co.nz>." },
  { typeId: "internet-material", rule: "7.1.4", text: "Ministry of Justice “Frequently Asked Questions – Electoral Finance Reform” <www.justice.govt.nz>." },
  { typeId: "podcast", rule: "7.1.8", text: "Russ Roberts “Richard Epstein on Regulation” (podcast, 30 August 2010) EconTalk <www.econtalk.org>." },
  { typeId: "newspaper-magazine-article", rule: "7.2", text: "Rob Hosking “Messy Allowance Law Finally Gets Clarity” The National Business Review (New Zealand, 17 July 2009) at 2." },
  { typeId: "newspaper-magazine-article", rule: "7.2", text: "Audrey Young “Entire NZ China trade board resigns” The New Zealand Herald (online ed, Auckland, 24 June 2011)." },
  { typeId: "newspaper-magazine-article", rule: "7.2", text: "Ruth Laugesen “Charge of the emissions brigade” New Zealand Listener (New Zealand, 24–30 September 2011) at 24." },
  { typeId: "newspaper-magazine-article", rule: "7.2", text: "“Lexington: The Next Supreme Court Justice” The Economist (online ed, London, 15 April 2010)." },
  { typeId: "newspaper-magazine-article", rule: "7.2", text: "Mary Scholtens “Judges as entitled to the rule of law as any other citizen” The Dominion Post (online ed, Wellington, 22 June 2010)." },

  // ═══════════════════════════════════ 2.3 — Subsequent references
  { typeId: "subsequent-references", rule: "2.3", text: "R v Wang, above n 49, at 533." },
  { typeId: "subsequent-references", rule: "2.3", text: "Smith “Rethinking the Defence of Mistake”, above n 25, at 431." },
  { typeId: "subsequent-references", rule: "2.3", text: "Baigent’s case, above n 4, at 668." },
];
