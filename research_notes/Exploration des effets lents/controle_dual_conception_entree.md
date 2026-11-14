# Dual control and least-costly / application-oriented input design for identifying slow dynamics under a profit constraint

Scope: what control and system-identification theory says about exciting a system to identify a slow mode (time constant τ ≈ 30–120 steps, here days) over a finite horizon (~365 steps) while limiting how much exploration costs. Target use: a closed-loop experiment for an autonomous Bayesian agent running a simulated business (price lever, binary maintenance action; hidden slow effects such as word-of-mouth, reputation, wear).

Research-method note: only web search was available. Full-text fetching was blocked for perso.uclouvain.be and people.kth.se (outside the session's allowed network domains), so most primary-source claims below rest on abstracts, bibliographic records and secondary citations returned by search. Items I could not check against a source are in the Gaps sections and marked "unverified recollection". Section 4 adds my own Cramér–Rao computations. They are labelled as such and can be reproduced from the model spec given.

---

## 1. Dual control: when does probing pay off compared with certainty equivalence, and how does the value of probing depend on horizon length?

### Takeaway
Exact dual control (Feldbaum) is a Bayesian dynamic program that is numerically intractable beyond toy problems. Practical theory gives three robust messages:
- Pure certainty-equivalence (CE) or cautious control can stop learning ("turn-off", incomplete learning), which costs regret that grows linearly with the horizon.
- A small amount of deliberate, decaying exploration fixes this. For linear-quadratic problems, CE plus naive exploration is rate-optimal (regret ~√T), so elaborate dual controllers are not needed to get the order of the regret right.
- Probing pays off most when uncertainty is large, the system can change abruptly, and enough horizon remains after the experiment to exploit what was learned. Information gathered near the end of a finite horizon is worth little.

### Cited Findings
- **Definition and origin (Feldbaum).** Feldbaum named the dual effect: the control action has to both "investigate" (probe to learn the parameters) and "direct" (control). Adaptive control looks only at past observations, while dual control also accounts for the future observations its actions will produce. — [Wittenmark, "Adaptive Dual Control", EOLSS chapter](https://www.eolss.net/sample-chapters/c18/e6-43-15-06.pdf)
- **Intractability (survey statement).** Wittenmark's overview says the optimal dual solution "can quite straightforwardly be characterized, but it is numerically demanding", and the paper surveys many suboptimal dual controllers. Citation: B. Wittenmark, "Adaptive Dual Control Methods: An Overview", 5th IFAC Symp. on Adaptive Systems in Control and Signal Processing, Budapest, 1995; IFAC Proceedings Volumes 28(13):67–72, DOI 10.1016/S1474-6670(17)45327-4. — [Lund University record](https://portal.research.lu.se/en/publications/adaptive-dual-control-methods-an-overview/); [Semantic Scholar](https://www.semanticscholar.org/paper/Adaptive-Dual-Control-Methods:-An-Overview-Wittenmark/63072f5b61a9763e397435538e26e409ccaa70b5)
- **Scale of the exact DP.** Åström & Helmersson (1986, "Dual control of an integrator with unknown gain", Computers & Mathematics with Applications 12(6A):653–662) solved a problem with one unknown parameter by dynamic programming. Secondary sources report it took about 180 CPU-hours for a 30-sample horizon. The paper compares dual, CE and cautious control on this problem. — [ResearchGate: "Simple example of dual control problem with almost analytical solution"](https://www.researchgate.net/publication/318147250_Simple_example_of_dual_control_problem_with_almost_analytical_solution); [Wittenmark EOLSS chapter](https://www.eolss.net/sample-chapters/c18/e6-43-15-06.pdf). (The CPU-hour figure comes from secondary sources and was not checked against the 1986 paper.)
- **Turn-off of cautious control.** Small control signals carry little information, so uncertainty stays high, which drives the cautious law to even smaller signals. Reviews call this a vicious circle that can switch the control off. Suboptimal fixes add perturbation signals to the cautious controller. In a process-control application, a dual controller improved performance by identifying gain changes better and preventing turn-off. — [Wittenmark EOLSS chapter](https://www.eolss.net/sample-chapters/c18/e6-43-15-06.pdf); [MPC-based dual control with online experiment design, J. Process Control 2015](https://www.sciencedirect.com/science/article/abs/pii/S0959152415000876)
- **Dual MPC survey.** A. Mesbah, "Stochastic model predictive control with active uncertainty learning: A survey on dual control", Annual Reviews in Control 45:107–117 (2018), DOI 10.1016/j.arcontrol.2017.11.001. It reviews MPC formulations in which the predicted uncertainty shrinks along the prediction horizon because of the active-learning term. — [researchr BibTeX](https://researchr.org/publication/Mesbah18-0/bibtex); [author PDF](https://static1.squarespace.com/static/5d4488dc0d24df0001719b1f/t/5d59d85ca827b9000184e753/1566169182091/ARC_2018.pdf)
- **When active learning helps (MPC).** Heirung, Paulson, Lee & Mesbah, "Model predictive control with active learning under model uncertainty: Why, when, and how", AIChE J. 64:3071–3081 (2018). In their simulations probing is "particularly beneficial when a system undergoes abrupt changes" such as a sudden fault. — [Wiley](https://aiche.onlinelibrary.wiley.com/doi/abs/10.1002/aic.16180)
- **Theorem: CE suboptimality is second order in parameter error.** Mania, Tu & Recht (2019) show that the gap between the cost of the CE controller and the optimal LQ cost scales with the square of the parameter error. They also prove Õ(√T) regret for CE with exploration noise whose variance decays as σ²_t ~ t^(-1/2). Dean et al. (2018) had earlier given Õ(T^(2/3)) regret for an explore-then-commit style CE scheme. — [arXiv 1902.07826](https://arxiv.org/pdf/1902.07826)
- **Theorem: √T is a lower bound and naive exploration achieves it.** Simchowitz & Foster (ICML 2020) prove minimax regret Θ̃(√(d_u² d_x T)) for online LQR with unknown dynamics, which rules out poly(log T) regret in general. CE with continual ε-greedy-type exploration (refining the estimate continually) reaches this rate. — [arXiv 2001.09576](https://arxiv.org/abs/2001.09576); [PMLR v119](http://proceedings.mlr.press/v119/simchowitz20a/simchowitz20a.pdf)
- **Pricing: CE pricing can lock onto a wrong price.** Certainty-equivalent (myopic) pricing can converge, with positive probability, to a non-optimal price, i.e., incomplete learning. den Boer & Zwart's "controlled variance pricing" (Management Science 60(3):770–783, 2014) charges the myopic price unless the sample variance of past prices would fall below a lower bound, in which case it adds a small perturbation. Reported regret is O(T^(1/2+δ)). Keskin & Zeevi (Operations Research 62(5):1142–1167, 2014) enforce price dispersion in a similar way ("constrained iterated least squares"). — [den Boer, "Dynamic pricing and learning: historical origins, current research, and new directions" (survey)](https://ris.utwente.nl/ws/files/5090800/memo2025.pdf); [Perturbed pricing, arXiv 2010.12300](https://arxiv.org/html/2010.12300)
- **Approximate Bayesian dual control in ML.** Klenske & Hennig, "Dual control for approximate Bayesian reinforcement learning" (JMLR 2016), approximate dual control for Gaussian-process (Bayesian) models. Directly relevant to a Bayesian agent. — [arXiv 1510.03591](https://arxiv.org/pdf/1510.03591)

### Inferences
- **Probing is worth it only if the identified τ will change decisions.** By Mania et al., a moderate error in τ costs only second-order profit if CE uses it. Large probing is therefore justified mainly when (a) the posterior over τ is wide enough that the CE policy could be qualitatively wrong (for example, never doing maintenance, or setting a price that slowly erodes reputation), or (b) the policy can get stuck (incomplete learning). Both conditions are common with slow hidden effects: their consequences show up long after the action, so the myopic gradient barely sees them.
- **Horizon dependence (standard DP reasoning, not a cited theorem).** In a finite-horizon Bayesian DP, information gathered at step t is valuable only through decisions taken after it is processed. For a slow mode, information about τ arrives about 1–3τ after the excitation (see Section 4). So the "exploitation window" is roughly 365 − t_probe − 2τ. For τ = 120 days, a probe started on day 0 delivers most of its τ-information around day 240–360, leaving little time to use it within a 365-day episode unless the agent values knowledge past the horizon (terminal value or a multi-episode setting). For τ = 30, the probe pays back within the episode. Practical implication: put exploration at the start of the horizon, and make its size depend on the remaining horizon.
- **Decaying-exploration schedules** (σ²_t ∝ t^(-1/2) in LQR; price-variance lower bounds in pricing) are a theoretically grounded default for a "budgeted" exploration rule in the agent. Section 4, however, shows that for a slow mode exploration has to come as long holds, not white dithering.
- The √T lower bound means some exploration cost is unavoidable when the optimal action depends on an unknown parameter that the optimal policy itself does not excite. The 2026 arXiv paper titled "Controller identifiability: The boundary between logarithmic and square-root local minimax regret" (see Gaps) suggests that when the optimal controller is itself informative, log-regret becomes possible.

### Gaps
- I could not get Wittenmark (1995) or the EOLSS chapter in full, so I have no verbatim list of "conditions under which dual control beats CE" (large initial uncertainty, long horizon, low noise, etc.). Unverified recollection: Wittenmark's surveys state the benefit is largest when parameter uncertainty is large relative to the control objective and when there is time to exploit learning.
- No quantitative result found on "value of probing as a function of horizon length" specific to slow modes. Recent arXiv leads, seen in search results but not read (2026, not peer-reviewed): "Dual Control: On Exploration–Exploitation in Linear Systems" ([arXiv 2608.20073](https://arxiv.org/html/2608.20073v1)); "Controller Identifiability: The Boundary Between Logarithmic and Square-Root Local Minimax Regret in Structured Adaptive LQR" ([arXiv 2609.37063](https://arxiv.org/html/2609.37063)); "Sharp Critical Minimax Laws and No-Learning Thresholds" ([arXiv 2609.33154](https://arxiv.org/pdf/2609.33154)); "Minimax optimal dual control – the single input case" ([arXiv 2604.18550](https://arxiv.org/pdf/2604.18550)).
- Exact horizon-related findings of Heirung et al. (2018) not retrieved.

---

## 2. Least-costly identification and application-oriented input design: how do experiment duration and power relate to τ and to the accuracy needed for control? Are there rules of thumb?

### Takeaway
The least-costly / application-oriented school (Bombois, Gevers, Hjalmarsson, Rojas and co-workers) reverses the classic problem. Instead of maximising information for a given budget, it minimises experiment cost (duration, excitation power, or performance degradation) subject to the identified model landing, with high probability, in the "application set" of models that are good enough for the intended controller. Main results:
- Excitation should be concentrated where the application is sensitive. For one time constant this means around ω ≈ 1/τ.
- The optimal input depends on the unknown system (chicken-and-egg). Robust (min-max) designs, approximated by bandlimited 1/f noise, cover a range of τ.
- Closed-loop experiments with near-optimal controllers are often the cheapest.

For a slow mode the quantitative consequence is severe: the optimal probing period 2πτ is 188–754 days, comparable to or longer than the 365-day horizon.

### Cited Findings
- **Least-costly identification (core formulation).** Bombois, Scorletti, Gevers, Van den Hof & Hildebrand, "Least costly identification experiment for control", Automatica 42(10):1651–1662 (2006), DOI 10.1016/j.automatica.2006.05.016. It asks for "the cheapest identification experiment that will give us an uncertainty set that is within the required bounds" for robust control. Cost is measured by "the experiment time, the performance degradation due to the added excitation signal, or a combination of both". Results are given for disturbance rejection. Two steps: (1) compute the largest admissible uncertainty region for the control objective; (2) design the least powerful input whose identified uncertainty region is no larger. An earlier version appeared at MTNS 2004. — [HAL record](https://dumas.ccsd.cnrs.fr/LMC-IMAG/hal-00413370v1); [TU Delft record](https://research.tudelft.nl/en/publications/least-costly-identification-experiement-for-control/)
- **Noted limitation.** Least-costly design keeps identification and normal operation as two distinct phases. Later MPC-integrated work (for example by Forgione, Bombois, Van den Hof) addresses this. — [Forgione ERNSI 2013 slides](https://www.dcsc.tudelft.nl/~mforgione/docs/presentations/forgione_ernsi2013_presentation.pdf); [Forgione ACC 2013 slides](https://www.dcsc.tudelft.nl/~mforgione/docs/presentations/forgione_acc2013_presentation.pdf)
- **Application set (application-oriented design).** The "application set" is the set of parameter vectors that give acceptable performance for the intended use. The input is designed so that the estimate falls in this set with a prescribed probability. Turning this into an optimization problem needs a convex approximation of the set. — [Ebadat et al., "Application set approximation in optimal input design for MPC", arXiv 1303.5199](https://arxiv.org/abs/1303.5199). Tutorial: Annergren, Larsson, Hjalmarsson, Bombois & Wahlberg, "Application-oriented input design in system identification: Optimal input design for control", IEEE Control Systems Magazine 37(2):31–56 (2017), DOI 10.1109/MCS.2016.2643243. — [ADS record](https://ui.adsabs.harvard.edu/abs/2017ICSys..37b..31A/abstract)
- **Time-domain and amplitude-constrained variants** (relevant for binary or bounded levers) exist: "Applications oriented input design in time-domain through cyclic methods". — [arXiv 1403.6953](https://arxiv.org/pdf/1403.6953)
- **Gevers & Ljung (1986), "Optimal experiment designs with respect to the intended model application"**, Automatica 22(5):543–554. If the model will be used for minimum-variance control, the optimal experiment is closed-loop with the (unknown) optimal minimum-variance controller in the loop. This holds under the high-order variance approximation, and the analysis covers variance error only, not bias. — [Semantic Scholar](https://www.semanticscholar.org/paper/Optimal-experiment-designs-with-respect-to-the-Gevers-Ljung/7e9929726f7108ec211a6074485c92c1c34d6edc); [Jansson & Hjalmarsson, "Optimal experiment design in closed loop", IFAC 2005](https://skoge.folk.ntnu.no/prost/proceedings/ifac2005/Fullpapers/04528.pdf); [Gevers, "Identification for control: achievements and open problems"](https://perso.uclouvain.be/michel.gevers/PublisMig/C128.pdf); [Hjalmarsson, Gevers & De Bruyne 1996, "For model-based control design, closed-loop identification gives better performance"](https://perso.uclouvain.be/michel.gevers/PublisMig/Hjalmars-Gevers-Debruyne-1996.pdf)
- **Hjalmarsson (2005), "From experiment design to closed-loop control"**, Automatica 41(3):393–438. The purpose of experiment design is "to make the collected data maximally informative with respect to the intended use of the model, subject to constraints". The paper also highlights applications where closed-loop experimentation helps. — [PDF (UBC course copy)](https://courses.ece.ubc.ca/574/Hjalmarsson_Automatica_March05.pdf)
- **Robust experiment design (chicken-and-egg).** Rojas, Welsh, Goodwin & Feuer, "Robust optimal experiment design for system identification", Automatica 43(6):993–1008 (2007), DOI 10.1016/j.automatica.2006.12.013. Min-max design over a prior parameter range, with existence and uniqueness theorems; the optimal input has finite spectral support. Among simple suboptimal inputs, "1/f" noise "performs surprisingly well". A companion paper, "Optimal experiment design with diffuse prior information", shows that bandlimited 1/f noise is optimal for a particular cost function. — [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0005109807000696); [Feuer PDF](https://webee.technion.ac.il/people/feuer/JournalPapers/56_Robust_Optimal_Experiment.pdf); follow-up: Rojas, Agüero, Welsh, Goodwin & Feuer, "Robustness in experiment design", IEEE TAC (2012), input design when only diffuse prior information is known — [Feuer PDF](https://webee.technion.ac.il/people/feuer/JournalPapers/62_Robustness_in_Experiment_Design.pdf)
- **Value of optimal versus simple inputs.** For low-order systems an optimal input can reduce the required input power by up to about 50% compared with simple choices. For higher-order systems a sinusoid is already a good choice. — [DiVA thesis paper, "On optimal input signal design for frequency response estimation"](https://www.diva-portal.org/smash/get/diva2:471654/FULLTEXT01.pdf)
- **Rivera-group process-control guidelines (heuristic).** PRBS and multisine design variables (switching time, number of shift registers, sequence length) are set from a priori dominant time constants and the desired closed-loop speed of response. The excitation band of interest is set by the dominant time constants. Increasing the α/β factors, or shortening the switching time, increases the number of non-suppressed frequencies. — [Lee & Rivera, CR-IDENT, SYSID 2006](https://labs.engineering.asu.edu/csel/wp-content/uploads/sites/43/2019/04/Sysid2006crident.pdf); [Rivera et al., DYCOPS 2004](https://skoge.folk.ntnu.no/prost/proceedings/dycops04/pdffiles/papers/31.pdf); [multi-level pseudo-random signal design paper](https://www.researchgate.net/publication/3810482_Multi-level_pseudo-random_signal_design_and_model-on-demand_estimation_applied_to_nonlinear_identification_of_a_RTP_wafer_reactor); [Häggblom, experiment designs for control-oriented MIMO identification](https://www.automaatioseura.fi/site/assets/files/1550/f2061.pdf); [Garcia-Gabin & Lundh, PRBS design for multivariable systems](http://users.abo.fi/khaggblo/npcw21/submissions/27_Garcia-Gabin&Lundh.pdf)
- **Practitioner heuristics (low-quality sources; heuristic only):**
  - Test duration of at least 5–10 dominant time constants (≥5τ for step tests, ≥10τ for PRBS).
  - PRBS clock period below τ/5; observe 7–10 PRBS pulses (thermal-process guidance).
  - PRBS of order n has maximum period 2^n − 1 clock periods, and the test length is often one full period.
  - Estimation variance falls with test duration and SNR and rises with the number of parameters.
  
  Sources: [Industrial Monitor Direct blog](https://industrialmonitordirect.com/blogs/knowledgebase/applied-system-identification-for-control-system-design); [MATLAB idinput doc (PRBS "Band" = inverse clock period)](https://www.mathworks.com/help/ident/ref/idinput.html); [ScienceDirect Topics: test signal](https://www.sciencedirect.com/topics/engineering/test-signal)

### Inferences
- **Optimal excitation frequency for a single time constant (my derivation, standard result).** For G(s) = K/(τs+1) with K known, ∂G/∂τ = −Ks/(τs+1)², so |∂G/∂τ(iω)|² = K²ω²/(1+ω²τ²)². This is maximised at ω* = 1/τ (checked numerically). The per-unit-power information about τ is therefore largest for a sinusoid at period 2πτ:

  | τ (days) | Optimal period 2πτ (days) | Cycles fitting in 365 days |
  |---|---|---|
  | 30 | ≈ 188 | ≈ 1.9 |
  | 60 | ≈ 377 | ≈ 0.97 |
  | 120 | ≈ 754 | ≈ 0.48 |

  The asymptotic frequency-domain theory behind most optimal and least-costly input design assumes N ≫ the period. That assumption fails here for τ ≥ ~60. Transient (finite-horizon, time-domain) design is needed, and the design reduces to "how many up/down switches, and when".
- **Implication of least-costly thinking for the agent.** The required accuracy of τ should come from how sensitive the agent's decision (price path, maintenance interval) and its profit are to τ: the "application set". It should not be a fixed target such as ±10%. If profit is flat in τ over the current posterior, the least costly experiment is no experiment.
- **Implication of Gevers–Ljung / Hjalmarsson.** Experimenting in closed loop around the current best (CE) operating policy, with small added excitation, is generally cheaper than open-loop tests far from the operating point. But the excitation must be external (a designed perturbation), because the policy itself may not be informative (Section 3).
- **Robust design under τ ∈ [30, 120].** Rojas et al. suggest spreading power over the band [1/120, 1/30] rad/day with a 1/f-shaped spectrum (more power at low frequency). In the time domain over a 365-day horizon, this roughly means a few long holds (≈ 2–4τ_min), and at most one or two very long ones covering τ_max. Section 4's numbers support this.
- **Rivera-type guidance applied (uses an unverified formula; see Gaps).** A PRBS covering τ_high = 120 with settling factor β_s = 3 needs sequence length N_s·T_sw ≳ 2π·3·120 ≈ 2,260 days, about 6× the horizon. A full PRBS period is impossible. Only a deterministic multi-step design is feasible.

### Gaps
- **Hjalmarsson 2009.** "System identification of complex and structured systems" (European Journal of Control 15(3–4), 2009; ECC plenary) could not be retrieved. Unverified recollection of its themes: "cost of complexity"; experiment cost is set by the application, not the system complexity; identify only what the application needs.
- **"Cost of complexity" quantitative result.** Rojas, Barenthin, Welsh & Hjalmarsson, Automatica 47(9), 2011 not retrieved. Unverified recollection: minimum input energy scales with model order and the required frequency range.
- **Bombois et al. numerical example.** Not retrieved (optimal spectrum, closed-loop vs open-loop cost comparison). Unverified recollection: closed-loop least-costly designs can be cheaper than open-loop ones in the disturbance-rejection setting.
- **Exact Rivera PRBS formula not confirmed.** Unverified recollection (Rivera & Jun, IEEE Control Systems Magazine 2000): T_sw ≤ 2.78·τ_dom^L/α_s and N_s = 2^{n_r} − 1 ≥ 2π·β_s·τ_dom^H/T_sw, where α_s is the closed-loop/open-loop speed ratio and β_s the settling-time factor (≈3 for 95%, ≈5 for 99%). The 2.78 factor corresponds to the PRBS spectrum's −3 dB point.
- **Rojas et al. first-order example.** No direct confirmation of their specific numerical results (the full text was blocked), for example the information ratio of 1/f noise versus the min-max optimum.
- **No least-costly result for slow modes over finite horizons.** I found no peer-reviewed result that explicitly gives "experiment duration as a function of τ and required accuracy" for this case. The closest substitute is the CRLB scaling in Section 4.

---

## 3. Persistent excitation, and why exploiting (certainty-equivalent) controllers lose identifiability: closed-loop identification, the turn-off phenomenon, Lai & Wei, Åström

### Takeaway
Under feedback, data generated by a fixed or CE controller can be uninformative: many parameter values reproduce the same closed-loop behaviour.
- Borkar–Varaiya and Polderman show that CE adaptive control converges to a parameter that is "closed-loop identifiable" but not necessarily true, giving a possibly suboptimal policy.
- Cautious controllers can turn themselves off.
- Lai & Wei give the sharp condition for strong consistency of least squares under adaptive (feedback) designs: the minimum eigenvalue of the information matrix must grow faster than the log of the maximum eigenvalue.
- The practical fix in control, LQR learning and pricing is the same: inject external excitation, or enforce a minimum dispersion of the lever, at a rate that decays slowly enough.

### Cited Findings
- **Borkar & Varaiya (1979), adaptive control of Markov chains.** Without an identifiability assumption, the maximum-likelihood estimate under CE control converges to a parameter θ* that produces the same closed-loop behaviour as the true one under the policy being used, "closed-loop identification", and θ* need not be the true parameter. With a finite parameter set the estimate converges a.s. to a random limit. The resulting policy can be suboptimal, which motivated "reward-biased" maximum-likelihood fixes. — [Mete et al., "Reward biased maximum likelihood estimation for RL", arXiv 2011.07738](https://arxiv.org/html/2011.07738v3); [PMLR v144 (Mete et al. 2021)](https://proceedings.mlr.press/v144/mete21a/mete21a.pdf); [Campi & Kumar, "Adaptive LQG control: the cost-biased approach revisited", SIAM J. Control Optim.](https://marco-campi.unibs.it/pdf-pszip/LQG-statespace-SIAM.pdf)
- **Polderman, "The closed-loop identification problem in indirect adaptive control".** Studies a fundamental limitation of indirect adaptive control based on a quadratic cost and the CE principle: the parameter estimate need not converge to the true value. — [ResearchGate record](https://www.researchgate.net/publication/224272585_The_closed-loop_identification_problem_in_indirect_adaptive_control)
- **Lai & Wei (1982), consistency of least squares under adaptive designs.** "Least squares estimates in stochastic regression models with applications to identification and control of dynamic systems", Annals of Statistics 10(1):154–166, DOI 10.1214/aos/1176345697. Gives a minimal sufficient condition for strong consistency of least squares when regressors are generated by feedback. Later work states the condition is sharp for adaptive designs, and a counterexample shows that a stronger condition is needed than in the non-adaptive case. — [Semantic Scholar](https://www.semanticscholar.org/paper/Least-Squares-Estimates-in-Stochastic-Regression-to-Lai-Wei/0aa1446c1fe6d2cb74508487cb27e48c9e8c36fb); [Electronic J. Statistics 2019 (discussion of sharpness)](https://projecteuclid.org/journals/electronic-journal-of-statistics/volume-13/issue-1/Strong-consistency-of-the-least-squares-estimator-in-regression-models/10.1214/19-EJS1558.pdf). **Note on conflicting snippets:** search snippets quoted the condition both as "log λ_max(n) = o(λ_min(n))" and as "log log λ_max(n) = o(λ_min(n))". My understanding (unverified this session) is that Lai & Wei's Theorem 1 uses λ_min(n) → ∞ with log λ_max(n) = o(λ_min(n)) a.s., giving the rate ‖θ̂_n − θ‖² = O(log λ_max(n)/λ_min(n)). The log-log form may come from the scalar or other special cases. Check the original.
- **Turn-off phenomenon (cautious control).** Small inputs give little information, which leads to even smaller inputs, a vicious circle that can switch the control off. It is caused by lack of excitation, which is why suboptimal dual controllers add perturbation signals. — [Wittenmark EOLSS chapter](https://www.eolss.net/sample-chapters/c18/e6-43-15-06.pdf); [MPC-based dual control with online experiment design](https://www.sciencedirect.com/science/article/abs/pii/S0959152415000876)
- **Pricing analogue.** CE pricing can converge with positive probability to a non-optimal price. Enforcing a lower bound on the sample variance of prices (den Boer & Zwart 2014) or price dispersion (Keskin & Zeevi 2014) restores consistency with O(T^(1/2+δ)) or √T-order regret. — [den Boer survey](https://ris.utwente.nl/ws/files/5090800/memo2025.pdf); [Perturbed pricing, arXiv 2010.12300](https://arxiv.org/html/2010.12300)
- **LQR analogue.** Exploration noise with variance ∝ t^(-1/2) added to CE gives √T regret (Mania et al.), and continual naive exploration is rate-optimal (Simchowitz & Foster). — [arXiv 1902.07826](https://arxiv.org/pdf/1902.07826); [arXiv 2001.09576](https://arxiv.org/abs/2001.09576)

### Inferences
- **Classic closed-loop non-identifiability (my derivation of the textbook example).** For y(t+1) = a·y(t) + b·u(t) + e(t) under a fixed linear feedback u(t) = −k·y(t), the closed loop is y(t+1) = (a − bk)·y(t) + e(t). Only the combination a − bk is identifiable: every (a, b) on the line a − bk = const fits the data equally well. External excitation, a time-varying or nonlinear controller, or switching between controllers breaks the degeneracy.
- **Business translation: maintenance.** If the CE policy maintains on a fixed schedule (or never), wear is only seen along that schedule. The data then pins down "the outcome of the current policy", not the wear time constant, and so cannot tell whether a different schedule would be better. This is the Borkar–Varaiya situation, and it calls for deliberate deviations from the schedule (skipping or advancing maintenance).
- **Business translation: price.** If price converges to a constant, price elasticity and any slow reputation response to price are not separately identifiable from the steady level, the den Boer–Zwart incomplete-learning situation. A minimum cumulative price dispersion is needed, and for a slow mode the dispersion must take the form of sustained deviations (Section 4).
- **Persistent excitation versus slow modes (textbook background, not re-verified this session).**
  - Ljung's definition: a signal is persistently exciting of order n if its n×n autocovariance matrix is positive definite, equivalently its spectrum is non-zero at ≥ n frequencies. A constant input is PE of order 1 only.
  - Holding a lever at a constant level for ever identifies the static gain but gives no asymptotic information about τ; only transients carry τ-information.
  - Repeated switching is therefore needed, and Lai & Wei-type growth of λ_min of the information matrix requires the number of informative transients to keep growing over time.
- **Bayesian agent caveat.** A Bayesian agent that maximises expected profit myopically (one-step or short-lookahead), or that is risk-averse, is a cautious controller and can turn off: it keeps the lever where the posterior is narrow. Posterior sampling (Thompson-style) or an explicit information bonus restores excitation. Both are suboptimal dual approximations; the second is related to the "perturbation signal" fix in the dual-control literature.

### Gaps
- Unverified recollection, not retrieved this session: Åström & Wittenmark (1973, "On self-tuning regulators", Automatica 9:185–199) showed that a minimum-variance self-tuner can converge to the optimal controller even though the parameter estimates do not converge to the true values (the "self-tuning property"). This is the positive counterpart of Borkar–Varaiya: identifiability is not needed if the controller you converge to is the optimal one. It fails when the unexcited parameters matter for the optimal policy.
- Unverified recollection: Gustavsson, Ljung & Söderström (1977, Automatica 13:59–75), "Identification of processes in closed loop: identifiability and accuracy aspects", which gives the formal closed-loop identifiability conditions (controller complexity, external excitation, controller switching).
- Unverified recollection: Cassel, Cohen & Koren (2020) show logarithmic LQR regret is possible when one of A or B is known; the 2026 arXiv paper on "controller identifiability" seems to generalise this boundary.

---

## 4. Quantitative guidance: how long to hold a step or plateau relative to τ, and how much information about τ a step response gives as a function of plateau length and noise

### Takeaway
- The response reaches 63% of steady state at 1τ and 95% at 3τ, but information about τ accumulates more slowly: only about 32% of a step's τ-information has arrived by 1τ, 76% by 2τ, 94% by 3τ (gain known).
- When the gain is also unknown, which is the realistic case, a plateau shorter than about 3τ gives almost no usable estimate of τ, because gain and τ are confounded until the plateau is seen.
- Over a 365-day horizon with daily white noise, the best binary designs are a few long holds with returns:
  - square-wave half-periods of about 2.5–4τ for τ = 30–60;
  - a single up-and-back pulse of about 1.5–2τ for τ = 120.
- These designs reach a relative standard deviation on τ of about 0.25–0.35 × (σ/K). Fast toggling (half-period ≤ 0.5τ) is 2–3× worse.

### Cited Findings
- No peer-reviewed source found that tabulates τ-information as a function of plateau length. The practitioner heuristics in Section 2 (≥5τ for step tests, ≥10τ total for PRBS, observe 7–10 pulses) are consistent with the computations below. — [Industrial Monitor Direct blog (heuristic)](https://industrialmonitordirect.com/blogs/knowledgebase/applied-system-identification-for-control-system-design)
- **Theory used for the computations.** Experiment design maximises the Fisher information of the intended parameters; the robust version optimises worst case over the prior range. — [Rojas et al. 2007, Automatica](https://www.sciencedirect.com/science/article/abs/pii/S0005109807000696); [Hjalmarsson 2005, Automatica](https://courses.ece.ubc.ca/574/Hjalmarsson_Automatica_March05.pdf)

### Inferences
All results in this subsection are my own derivations and computations: Cramér–Rao lower bounds, which approximate the posterior standard deviation of a Bayesian agent with a weak prior.

**Model.** Discrete first-order: x(t+1) = a·x(t) + (1 − a)·K·u(t), with a = e^(−1/τ); observation y(t) = c + x(t) + e(t), e ~ N(0, σ²) white, one sample per day; u ∈ {0, 1} (binary lever, or a two-level price). Unknowns: τ, plus K (steady-state effect) and/or c (baseline) where stated. Results are for K/σ = 1. **Relative std(τ̂)/τ scales as σ/K**, and roughly as 1/√(number of independent switching cycles).

**(a) Step-response fractions (mathematical identity).** 1 − e^(−n) = 63.2% (1τ), 86.5% (2τ), 95.0% (3τ), 98.2% (4τ), 99.3% (5τ).

**(b) Sensitivity and information about τ from one step (gain known).** ∂y/∂τ = −K·(t/τ²)·e^(−t/τ). It peaks at t = τ and is effectively zero after about 5τ. Continuous approximation of the Fisher information for τ over a plateau of length T:
  - I(T) = (K²/σ²)·(τ/4)·(1/τ²)·P(3, 2T/τ), with P the regularised incomplete gamma function. Fraction of total = 1 − e^(−x)(1 + x + x²/2), x = 2T/τ.
  - **Fraction of τ-information captured:**

    | Plateau length | 1τ | 2τ | 3τ | 4τ | 5τ |
    |---|---|---|---|---|---|
    | Information captured | 32% | 76% | 94% | 98.6% | 99.7% |

  - Asymptotic CRLB: std(τ̂)/τ ≥ 2σ/(K√τ). For τ = 60 and K/σ = 1, that is about 0.26. Numerically confirmed: 0.258.

**(c) One step with K unknown, and with K and baseline c unknown (numerical CRLB, rel. std of τ, K/σ = 1).**

| Plateau T | τ = 30: K known / K unknown / K,c unknown | τ = 60 | τ = 120 |
|---|---|---|---|
| 0.5τ | 1.24 / 22.2 / 22.9 | 0.89 / 16.3 / 17.1 | 0.64 / 11.7 / 12.8 |
| 1τ | 0.63 / 5.25 / 5.49 | 0.45 / 3.77 / 4.09 | 0.32 / 2.69 / 3.07 |
| 2τ | 0.42 / 1.54 / 1.64 | 0.30 / 1.10 / 1.22 | 0.21 / 0.78 / 0.92 |
| 3τ | 0.38 / 0.89 / 0.96 | 0.27 / 0.63 / 0.71 | 0.19 / 0.45 / 0.54 |
| 5τ | 0.37 / 0.56 / 0.61 | 0.26 / 0.40 / 0.45 | 0.18 / 0.28 / 0.34 |
| 10τ | 0.37 / 0.43 / 0.46 | 0.26 / 0.30 / 0.34 | 0.18 / 0.21 / 0.26 |

(The "K,c unknown" case includes a 30-day pre-step baseline.)

Reading: with an unknown gain, a 1τ plateau is about 6–12× worse than the gain-known bound, and 3τ is about 2.4× worse. Roughly 5τ is needed to get within 1.5× of the bound. This matches the "≥5τ step test" heuristic.

**(d) 365-day horizon, 30-day baseline at u = 0, then binary 0/1 square wave with half-period P (K and c unknown, K/σ = 1).**

| Design | τ = 30 | τ = 60 | τ = 120 |
|---|---|---|---|
| P = 0.25τ | 0.75 | 0.72 | 0.97 |
| P = 0.5τ | 0.58 | 0.57 | 0.73 |
| P = 1τ | 0.44 | 0.42 | 0.48 |
| P = 1.5τ | 0.38 | 0.35 | **0.33** (one up-and-back, 180 d) |
| P = 2τ | 0.33 | 0.34 | 0.34 |
| P = 2.5τ | 0.31 | 0.29 | 0.49 |
| P = 3τ | **0.28** | **0.27** | 0.59 (no return) |
| P = 4τ | 0.29 | **0.25** | 0.59 |
| Single step held to day 365 (92% of days at probe level) | 0.45 | 0.42 | 0.59 |
| Single up-and-back pulse of 2τ | 0.42 (16% probe days) | 0.33 (33%) | 0.34 (66%) |
| Single up-and-back pulse of 3τ | 0.35 (25%) | 0.27 (49%) | n/a |

Readings:
  - **The best half-period is about 3τ when the horizon allows**, consistent with the frequency-domain optimum ω* = 1/τ (half-period πτ ≈ 3.1τ).
  - **Returning to baseline matters.** An up-and-back pulse beats a permanent step while spending about half as many days at the probe level, because the return transient adds τ-information and separates K from the baseline c.
  - **For τ = 120 the horizon binds.** The best design is one long pulse of about 1.5–2τ (180–240 days), started early.
  - **Fast toggling is inefficient for slow modes** (P ≤ 0.5τ: 0.57–0.97). The slow mode low-pass filters the excitation away. Generic PRBS heuristics like "clock period < τ/5" are aimed at bandwidth or fast dynamics and are counter-productive here.
  - **Required effect size.** For ±20% (1σ) on τ with the best design, K/σ ≳ 1.4 (τ = 30), 1.25 (τ = 60), 1.65 (τ = 120). For ±50%, K/σ ≳ 0.5–0.7. If the slow effect's steady-state size is only 0.25σ of daily noise, the best achievable relative std is about 1.0–1.3, so τ is effectively unidentifiable within a year by any binary design. The agent should then rely on its prior, or use a lever with a larger effect.
  - **Cost accounting.** For a binary action (maintenance), exploration cost is roughly proportional to the number of days spent at the non-preferred level. Pulses with returns give the best information per probe-day; they are comparable to or better than square waves. For a continuous lever (price) dithered symmetrically ±A around the CE optimum, profit loss is about ∝ A² × days (quadratic curvature), while information ∝ A². So the information-per-cost ratio does not depend on A. The design choice is then the switching pattern (long holds of about 2–4τ), and the amplitude is set by the profit budget.

**Caveats on these numbers.**
  - White noise is assumed. Autocorrelated or low-frequency business noise (seasonality, drift) competes directly with the slow mode and would degrade these bounds. Detrending, or control periods, would be needed.
  - A single first-order mode is assumed. Additional fast dynamics or nonlinear reputation effects change the numbers.
  - The CRLB is local, evaluated at the true τ. A Bayesian design should average it over the prior on τ ∈ [30, 120], in the spirit of Rojas et al.'s robust design. That favours a schedule mixing about 2–3 holds of roughly 60–90 days with one longer hold, which is approximately "1/f-like".

### Gaps
- No primary peer-reviewed source found that tabulates information about τ against plateau length, or that gives an "optimal number of switches over a finite horizon" for a slow first-order mode. The numbers above are my computations and need cross-checking (for example by simulating a Bayesian/MCMC posterior under the same model).
- Not computed: effect of coloured noise; joint identification of a fast and a slow mode; nonlinear or saturating word-of-mouth dynamics; delayed onset (dead time); optimal non-periodic schedules (for example front-loaded designs that maximise a horizon-discounted value of information).
